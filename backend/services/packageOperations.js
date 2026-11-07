const path = require('path');
const fs = require('fs');
const adb = require('./adb');
const packageKnowledge = require('./packageKnowledge');
const packageScanner = require('./packageScanner');
const backupService = require('./backupService');
const audit = require('./audit');
const jobManager = require('./jobManager');

const SYSTEM_DIRS_GUARD = new Set([
  '/',
  '/system',
  '/system/',
  '/system/app',
  '/system/app/',
  '/system/priv-app',
  '/system/priv-app/',
  '/system/framework',
  '/system/framework/',
  '/vendor',
  '/vendor/',
  '/vendor/app',
  '/vendor/app/',
  '/data',
  '/data/',
  '/data/app',
  '/data/app/'
]);

const INSTALL_ERROR_MAP = {
  'INSTALL_FAILED_OLDER_SDK': 'The app needs a newer Android than this phone has.',
  'INSTALL_FAILED_INSUFFICIENT_STORAGE': 'Not enough storage space on the phone. Check free space on /data.',
  'INSTALL_FAILED_ALREADY_EXISTS': 'Package already installed. Enable replace (-r) option.',
  'INSTALL_FAILED_UPDATE_INCOMPATIBLE': 'Signature mismatch with the currently installed version. Uninstall the existing copy first.',
  'INSTALL_FAILED_VERSION_DOWNGRADE': 'The APK version is older than the installed version. Enable downgrade (-d) option.',
  'INSTALL_FAILED_NO_MATCHING_ABIS': 'The APK has no native CPU code matching this device architecture.',
  'INSTALL_FAILED_USER_RESTRICTED': 'Installation restricted by device policy. Enable "Install via USB" in Developer options.',
  'INSTALL_PARSE_FAILED_NOT_APK': 'The file is not a valid APK archive.',
  'INSTALL_PARSE_FAILED_BAD_MANIFEST': 'The APK AndroidManifest.xml is corrupt or incompatible with this Android version.',
  'INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION': 'Failed to parse APK package structure.'
};

function mapInstallError(rawError) {
  if (!rawError) return 'Installation failed.';
  for (const [code, msg] of Object.entries(INSTALL_ERROR_MAP)) {
    if (rawError.includes(code)) {
      return msg;
    }
  }
  if (rawError.includes('INSTALL_PARSE_FAILED_')) {
    return 'The APK is corrupt or not valid for this Android version.';
  }
  return rawError;
}

class PackageOperations {
  /**
   * Dry run / Plan generator
   */
  async createPlan(serial, action, packageNames = [], options = {}) {
    if (!serial) throw new Error('Device serial is required.');
    if (!['disable', 'enable', 'uninstall', 'delete', 'restore'].includes(action)) {
      throw new Error(`Invalid plan action: "${action}". Must be disable, enable, uninstall, delete, or restore.`);
    }

    const caps = await adb.getDeviceCapabilities(serial);
    const scanned = await packageScanner.scanPackages(serial);
    const scannedMap = new Map(scanned.map(p => [p.name, p]));

    const context = {
      activeLauncher: caps.activeLauncher || null,
      activeIme: caps.activeIme || null
    };

    const validatedPackages = [];
    const warnings = [];
    const blockedReasons = [];
    let isBlocked = false;
    let requiresAckConfirmation = false;
    let requiresModelConfirmation = false;

    // Check root requirement for permanent delete
    if (action === 'delete') {
      requiresModelConfirmation = true;
      if (!caps.rootAvailable) {
        isBlocked = true;
        blockedReasons.push('Permanent deletion of system apps requires root access (su with uid=0). This device is not rooted.');
      }
    }

    // Check provisioning warnings if removing setupwizard
    const hasSetupWizard = packageNames.some(p => p.includes('setupwizard') || p.includes('provision'));
    if (hasSetupWizard && (action === 'disable' || action === 'uninstall' || action === 'delete')) {
      if (caps.provisioned !== '1' || caps.setupComplete !== '1') {
        warnings.push({
          type: 'provisioning',
          severity: 'caution',
          message: 'Setup Wizard / Provisioning package selected, but device provisioning state is not 1. Removing it may prevent device use.'
        });
      }
    }

    // Dependency group tracking
    const selectedSet = new Set(packageNames);
    const missingGroupMembers = new Map(); // groupId -> missing packages

    for (const pkgName of packageNames) {
      if (!packageScanner.isValidPackageName(pkgName)) {
        isBlocked = true;
        blockedReasons.push(`Invalid package name format: "${pkgName}".`);
        continue;
      }

      const pkgInfo = scannedMap.get(pkgName) || {
        name: pkgName,
        category: 'unknown',
        enabled: true,
        paths: [],
        knowledge: packageKnowledge.lookup(pkgName)
      };

      const protection = packageKnowledge.isProtected(pkgName, context);
      const isProtected = protection.protected;

      // Cannot remove or disable protected packages
      if (isProtected && (action === 'disable' || action === 'uninstall' || action === 'delete')) {
        isBlocked = true;
        blockedReasons.push(`Package "${pkgName}" is protected: ${protection.reason}`);
      }

      // Check dependency group
      const depGroup = packageKnowledge.getDependencyGroup(pkgName);
      if (depGroup && (action === 'disable' || action === 'uninstall' || action === 'delete')) {
        const missing = depGroup.packages.filter(p => !selectedSet.has(p) && scannedMap.has(p) && p !== 'com.android.providers.calendar');
        if (missing.length > 0) {
          missingGroupMembers.set(depGroup.id, {
            groupName: depGroup.name,
            rule: depGroup.rule,
            description: depGroup.description,
            missing
          });
        }
      }

      // Check safety level
      const safety = pkgInfo.knowledge ? pkgInfo.knowledge.safety : 'unknown';
      if (safety === 'caution' || safety === 'unknown' || pkgInfo.category === 'system' || pkgInfo.category === 'system-updated') {
        if (action === 'disable' || action === 'uninstall' || action === 'delete') {
          requiresAckConfirmation = true;
        }
      }

      if (safety === 'caution') {
        warnings.push({
          type: 'safety_caution',
          package: pkgName,
          severity: 'caution',
          message: `Package "${pkgName}" has safety level CAUTION: ${pkgInfo.knowledge.description}`
        });
      } else if (safety === 'unknown') {
        warnings.push({
          type: 'safety_unknown',
          package: pkgName,
          severity: 'unknown',
          message: `Package "${pkgName}" is NOT in the knowledge base. Always back up before removal.`
        });
      }

      validatedPackages.push({
        name: pkgName,
        category: pkgInfo.category,
        currentEnabled: pkgInfo.enabled,
        paths: pkgInfo.paths,
        protected: isProtected,
        protectedReason: protection.reason || null,
        safety,
        knowledge: pkgInfo.knowledge,
        dependencyGroup: depGroup ? depGroup.name : null
      });
    }

    // Add dependency warnings
    for (const [groupId, info] of missingGroupMembers.entries()) {
      warnings.push({
        type: 'dependency_group',
        group: groupId,
        groupName: info.groupName,
        severity: 'caution',
        message: `${info.groupName}: ${info.description}. Missing from selection: ${info.missing.join(', ')}`,
        missingPackages: info.missing
      });
    }

    // Determine target execution steps
    const plannedSteps = validatedPackages.map((pkg, idx) => {
      let desc = '';
      if (action === 'disable') {
        desc = `Disable package ${pkg.name} (reversible via pm enable).`;
      } else if (action === 'enable') {
        desc = `Enable package ${pkg.name}.`;
      } else if (action === 'uninstall') {
        if (pkg.category === 'system-updated') {
          desc = `Uninstall update for ${pkg.name}. Built-in factory version will reappear.`;
        } else if (pkg.category === 'system') {
          desc = `Uninstall for current user (--user 0). Keeps system APK file.`;
        } else {
          desc = `Uninstall user package ${pkg.name}.`;
        }
      } else if (action === 'delete') {
        desc = `Permanently delete system APK files for ${pkg.name} (root rw remount, rm APK/.odex/dalvik-cache).`;
      } else if (action === 'restore') {
        desc = `Restore package ${pkg.name} from backup manifest.`;
      }

      return {
        stepNumber: idx + 1,
        package: pkg.name,
        action,
        description: desc
      };
    });

    return {
      action,
      serial,
      device: {
        model: caps.model,
        androidVersion: caps.androidVersion,
        apiLevel: caps.apiLevel,
        rootAvailable: caps.rootAvailable
      },
      packages: validatedPackages,
      steps: plannedSteps,
      warnings,
      blocked: isBlocked,
      blockedReasons,
      requiresAckConfirmation,
      requiresModelConfirmation,
      defaultBackupFirst: action === 'disable' || action === 'uninstall' || action === 'delete'
    };
  }

  /**
   * Execute an approved plan asynchronously as a Job
   */
  async executePlan(serial, plan, jobId) {
    const job = jobManager.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found.`);

    jobManager.startJob(jobId);

    const { action, packages = [], options = {} } = plan;
    const caps = await adb.getDeviceCapabilities(serial);

    const packageNames = packages.map(p => typeof p === 'string' ? p : p.name);
    const results = [];
    let rebootRecommended = false;

    try {
      // Hard backend security guard: verify NO protected packages in removal actions
      if (action === 'disable' || action === 'uninstall' || action === 'delete') {
        const context = {
          activeLauncher: caps.activeLauncher || null,
          activeIme: caps.activeIme || null
        };
        for (const name of packageNames) {
          const prot = packageKnowledge.isProtected(name, context);
          if (prot.protected) {
            throw new Error(`SECURITY BLOCKED: Cannot modify protected package "${name}". Reason: ${prot.reason}`);
          }
        }
      }

      // Step 1: Backup verification (Default ON for removals)
      let backupSummary = null;
      if (options.backupFirst !== false && (action === 'disable' || action === 'uninstall' || action === 'delete')) {
        jobManager.sendEvent(jobId, {
          step: 'backup',
          status: 'running',
          message: `Backing up ${packageNames.length} packages to host PC...`
        });

        try {
          const backupRes = await backupService.createBackup(
            serial,
            packageNames,
            options,
            (progressEvent) => jobManager.sendEvent(jobId, progressEvent)
          );
          backupSummary = backupRes;
          jobManager.sendEvent(jobId, {
            step: 'backup',
            status: 'done',
            message: `Backup verified and saved to host (${backupRes.backupId}).`
          });
        } catch (backupErr) {
          throw new Error(`PRE-FLIGHT BACKUP FAILED: ${backupErr.message}. Aborting removal to protect device.`);
        }
      }

      // Step 2: Remount /system rw if permanent delete or restore system app
      let systemRemounted = false;
      if (action === 'delete') {
        jobManager.sendEvent(jobId, {
          step: 'remount',
          status: 'running',
          message: 'Remounting /system as read-write...'
        });

        // 2.a Find remount device from /proc/mounts
        let remountDev = null;
        try {
          const { stdout: mountsOut } = await adb.execAdb(['-s', serial, 'shell', 'cat', '/proc/mounts']);
          const lines = mountsOut.split('\n');
          for (const l of lines) {
            const parts = l.trim().split(/\s+/);
            if (parts.length >= 2 && parts[1] === '/system') {
              remountDev = parts[0];
              break;
            }
          }
        } catch (_) {}

        // 2.b Run remount rw
        let remountSuccess = false;
        if (remountDev) {
          try {
            await adb.runAsRoot(serial, `mount -o remount,rw ${remountDev} /system`);
            remountSuccess = true;
          } catch (_) {}
        }
        if (!remountSuccess) {
          try {
            await adb.runAsRoot(serial, 'mount -o remount,rw /system');
            remountSuccess = true;
          } catch (rErr) {
            throw new Error(`Failed to remount /system read-write: ${rErr.message}`);
          }
        }

        // 2.c Write test (touch & rm)
        try {
          await adb.runAsRoot(serial, 'touch /system/.rwtest && rm -f /system/.rwtest');
          systemRemounted = true;
          jobManager.sendEvent(jobId, {
            step: 'remount',
            status: 'done',
            message: '/system mounted read-write and write test verified.'
          });
        } catch (testErr) {
          throw new Error(`Write test failed on /system: ${testErr.message}. Aborting before any files were deleted.`);
        }
      }

      // Step 3: Execute action per package
      const totalPkgs = packageNames.length;

      for (let i = 0; i < totalPkgs; i++) {
        if (job.cancelled) {
          jobManager.sendEvent(jobId, {
            step: 'cancelled',
            status: 'skipped',
            message: 'Job cancelled by user. Remaining steps skipped.'
          });
          break;
        }

        const pkgName = packageNames[i];
        jobManager.sendEvent(jobId, {
          step: 'package_action',
          package: pkgName,
          status: 'running',
          message: `Processing ${pkgName} (${i + 1}/${totalPkgs})...`,
          progress: { current: i + 1, total: totalPkgs }
        });

        try {
          if (action === 'disable') {
            let executedCmd = '';
            let success = false;
            let lastOutput = '';

            // 1. Try standard pm disable-user --user 0
            try {
              const res = await adb.execAdb(['-s', serial, 'shell', 'pm', 'disable-user', '--user', '0', pkgName]);
              lastOutput = (res.stdout || '') + (res.stderr || '');
              executedCmd = `pm disable-user --user 0 ${pkgName}`;
              if (/new state:\s*disabled/i.test(lastOutput)) {
                success = true;
              }
            } catch (_) {}

            // 2. Try standard pm disable
            if (!success) {
              try {
                const res = await adb.execAdb(['-s', serial, 'shell', 'pm', 'disable', pkgName]);
                lastOutput = (res.stdout || '') + (res.stderr || '');
                executedCmd = `pm disable ${pkgName}`;
                if (/new state:\s*disabled/i.test(lastOutput)) {
                  success = true;
                }
              } catch (_) {}
            }

            // 3. Fall back to root escalation if device is rooted and standard pm failed or was rejected silently
            if (!success && caps.rootAvailable) {
              try {
                const rootRes = await adb.runAsRoot(serial, `pm disable ${pkgName}`);
                lastOutput = (rootRes.stdout || '') + (rootRes.stderr || '');
                executedCmd = `su: pm disable ${pkgName}`;
                if (/new state:\s*disabled/i.test(lastOutput)) {
                  success = true;
                }
              } catch (_) {}

              if (!success) {
                try {
                  const rootRes = await adb.runAsRoot(serial, `pm disable-user --user 0 ${pkgName}`);
                  lastOutput = (rootRes.stdout || '') + (rootRes.stderr || '');
                  executedCmd = `su: pm disable-user --user 0 ${pkgName}`;
                  if (/new state:\s*disabled/i.test(lastOutput)) {
                    success = true;
                  }
                } catch (_) {}
              }
            }

            // 4. Verification check via pm list packages -d
            const { stdout: disOut } = await adb.execAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', '-d']);
            const isNowDisabled = disOut.split('\n').some(l => l.trim() === `package:${pkgName}`);

            if (!isNowDisabled && !success) {
              throw new Error(`Failed to disable ${pkgName}: Android package manager did not confirm disabled state. ${lastOutput.trim() || 'Permission denied or unsupported by firmware.'}`);
            }

            audit.log({
              serial,
              package: pkgName,
              action: 'disable',
              command: executedCmd,
              result: isNowDisabled ? 'disabled' : 'unverified',
              status: isNowDisabled ? 'success' : 'warn'
            });

            results.push({ package: pkgName, action: 'disable', success: true });
            jobManager.sendEvent(jobId, {
              step: 'package_action',
              package: pkgName,
              status: 'done',
              message: `Disabled ${pkgName}.`,
              progress: { current: i + 1, total: totalPkgs }
            });

          } else if (action === 'enable') {
            let executedCmd = `pm enable ${pkgName}`;
            let success = false;
            let lastOutput = '';

            try {
              const res = await adb.execAdb(['-s', serial, 'shell', 'pm', 'enable', pkgName]);
              lastOutput = (res.stdout || '') + (res.stderr || '');
              if (/new state:\s*enabled/i.test(lastOutput)) {
                success = true;
              }
            } catch (_) {}

            if (!success && caps.rootAvailable) {
              try {
                const rootRes = await adb.runAsRoot(serial, `pm enable ${pkgName}`);
                lastOutput = (rootRes.stdout || '') + (rootRes.stderr || '');
                executedCmd = `su: pm enable ${pkgName}`;
                if (/new state:\s*enabled/i.test(lastOutput)) {
                  success = true;
                }
              } catch (_) {}
            }

            // Verification check: ensure NOT in pm list packages -d
            const { stdout: disOut } = await adb.execAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', '-d']);
            const isStillDisabled = disOut.split('\n').some(l => l.trim() === `package:${pkgName}`);

            if (isStillDisabled && !success) {
              throw new Error(`Failed to enable ${pkgName}: Package is still marked disabled. ${lastOutput.trim()}`);
            }

            audit.log({
              serial,
              package: pkgName,
              action: 'enable',
              command: executedCmd,
              result: 'enabled',
              status: 'success'
            });

            results.push({ package: pkgName, action: 'enable', success: true });
            jobManager.sendEvent(jobId, {
              step: 'package_action',
              package: pkgName,
              status: 'done',
              message: `Enabled ${pkgName}.`,
              progress: { current: i + 1, total: totalPkgs }
            });

          } else if (action === 'uninstall') {
            const allScanned = await packageScanner.scanPackages(serial);
            const pkgInfo = allScanned.find(p => p.name === pkgName);
            let executedCmd = '';
            let note = null;

            if (pkgInfo && pkgInfo.category === 'system-updated') {
              // Uninstalling removes update and reverts to built-in system copy
              executedCmd = `adb uninstall ${pkgName}`;
              const { stdout } = await adb.execAdb(['-s', serial, 'uninstall', pkgName]);
              note = 'Removed the Play Store update only. Built-in factory system version is now active.';
              rebootRecommended = true;
            } else if (pkgInfo && pkgInfo.category === 'system' && !caps.rootAvailable && caps.apiLevel >= 21) {
              // Non-root system uninstall for current user
              executedCmd = `pm uninstall -k --user 0 ${pkgName}`;
              try {
                await adb.execAdb(['-s', serial, 'shell', 'pm', 'uninstall', '-k', '--user', '0', pkgName]);
              } catch (_) {
                // Fall back to disable
                await adb.execAdb(['-s', serial, 'shell', 'pm', 'disable-user', '--user', '0', pkgName]);
                executedCmd = `fallback: pm disable-user --user 0 ${pkgName}`;
              }
            } else {
              // User app
              const uninstallArgs = ['-s', serial, 'uninstall'];
              if (options.keepData) uninstallArgs.push('-k');
              uninstallArgs.push(pkgName);
              executedCmd = `adb ${uninstallArgs.slice(2).join(' ')}`;
              await adb.execAdb(uninstallArgs);
            }

            audit.log({
              serial,
              package: pkgName,
              action: 'uninstall',
              command: executedCmd,
              result: note || 'uninstalled',
              status: 'success'
            });

            results.push({ package: pkgName, action: 'uninstall', success: true, note });
            jobManager.sendEvent(jobId, {
              step: 'package_action',
              package: pkgName,
              status: 'done',
              message: note ? `Uninstalled update for ${pkgName} (${note})` : `Uninstalled ${pkgName}.`,
              progress: { current: i + 1, total: totalPkgs }
            });

          } else if (action === 'delete') {
            // Mode C: Permanent delete of system app (root)
            rebootRecommended = true;

            // Resolve target file or folder
            let remotePaths = [];
            try {
              const { stdout: pOut } = await adb.execAdb(['-s', serial, 'shell', 'pm', 'path', pkgName]);
              remotePaths = pOut.split('\n').map(l => l.trim().replace(/^package:/, '')).filter(Boolean);
            } catch (_) {}

            if (remotePaths.length === 0) {
              const allScanned = await packageScanner.scanPackages(serial);
              const found = allScanned.find(p => p.name === pkgName);
              if (found && found.paths) remotePaths = found.paths;
            }

            if (remotePaths.length === 0) {
              jobManager.sendEvent(jobId, {
                step: 'package_action',
                package: pkgName,
                status: 'skipped',
                message: `Package ${pkgName} was already removed or has no APK paths.`
              });
              results.push({ package: pkgName, action: 'delete', status: 'skipped', reason: 'Not found' });
              continue;
            }

            for (const remotePath of remotePaths) {
              const parentDir = path.posix.dirname(remotePath);
              const fileName = path.posix.basename(remotePath);

              let deleteTarget = remotePath;

              // On Android 5.0+, apps live in /system/app/Name/Name.apk
              // If parentDir is NOT /system/app or /system/priv-app or /vendor/app, delete the enclosing folder
              const isDirectInAppDir = parentDir === '/system/app' || parentDir === '/system/priv-app' || parentDir === '/vendor/app' || parentDir === '/oem/app' || parentDir === '/product/app';
              if (!isDirectInAppDir && (caps.apiLevel >= 21 || parentDir.startsWith('/system/app/') || parentDir.startsWith('/system/priv-app/'))) {
                deleteTarget = parentDir;
              }

              // Strict Hard Security Guard
              if (SYSTEM_DIRS_GUARD.has(deleteTarget) || !deleteTarget || deleteTarget.trim() === '') {
                throw new Error(`CRITICAL GUARD TRIGGERED: Delete target "${deleteTarget}" is a critical system directory! Refusing.`);
              }

              // pm clear <pkg>
              try {
                await adb.execAdb(['-s', serial, 'shell', 'pm', 'clear', pkgName]);
              } catch (_) {}

              // rm -rf <target>
              await adb.runAsRoot(serial, `rm -rf "${deleteTarget}"`);

              // Android 4.x: rm <file>.odex if direct file
              if (deleteTarget.endsWith('.apk')) {
                const odexTarget = deleteTarget.replace(/\.apk$/, '.odex');
                await adb.runAsRoot(serial, `rm -f "${odexTarget}"`).catch(() => {});
              }

              // Android 4.x Dalvik cache clean
              if (caps.apiLevel < 21) {
                try {
                  const { stdout: dalvikOut } = await adb.runAsRoot(serial, 'ls /data/dalvik-cache');
                  const dalvikFiles = dalvikOut.split('\n').map(l => l.trim()).filter(Boolean);
                  const baseNameNoExt = fileName.replace(/\.apk$/, '');
                  for (const dFile of dalvikFiles) {
                    if (dFile.includes(baseNameNoExt) || dFile.includes(pkgName)) {
                      await adb.runAsRoot(serial, `rm -f "/data/dalvik-cache/${dFile}"`).catch(() => {});
                    }
                  }
                } catch (_) {}
              }

              audit.log({
                serial,
                package: pkgName,
                action: 'permanent_delete',
                command: `rm -rf "${deleteTarget}"`,
                result: 'deleted',
                status: 'success'
              });
            }

            results.push({ package: pkgName, action: 'delete', success: true });
            jobManager.sendEvent(jobId, {
              step: 'package_action',
              package: pkgName,
              status: 'done',
              message: `Permanently deleted system files for ${pkgName}.`,
              progress: { current: i + 1, total: totalPkgs }
            });

          } else if (action === 'restore') {
            const { backupId } = options;
            if (!backupId) throw new Error('options.backupId is required for restore.');

            const manifest = await backupService.getBackupDetails(serial, backupId);
            const pkgEntry = (manifest.packages || []).find(p => p.name === pkgName);

            if (!pkgEntry || !pkgEntry.files || pkgEntry.files.length === 0) {
              throw new Error(`Package ${pkgName} has no files in backup ${backupId}.`);
            }

            const caps = await adb.getDeviceCapabilities(serial);
            const deviceFolder = backupService._getDeviceFolder(caps.model, serial);
            let sessionDir = path.join(deviceFolder, backupId);
            if (!fs.existsSync(sessionDir)) {
              const allB = await backupService.listBackups(serial);
              const found = allB.find(b => b.backupId === backupId);
              if (found) sessionDir = path.join(found.deviceFolder, backupId);
            }

            // Verify hashes of all files in backup first
            const verifiedFiles = [];
            for (const f of pkgEntry.files) {
              const localPath = await backupService.verifyBackupFile(sessionDir, f);
              verifiedFiles.push({ ...f, localPath });
            }

            const isSystem = pkgEntry.category === 'system' || pkgEntry.category === 'system-updated';

            if (isSystem && caps.rootAvailable) {
              // Restore system app via root remount + push + chmod 644
              rebootRecommended = true;

              // Remount rw if not yet remounted
              if (!systemRemounted) {
                await adb.runAsRoot(serial, 'mount -o remount,rw /system');
                await adb.runAsRoot(serial, 'touch /system/.rwtest && rm -f /system/.rwtest');
                systemRemounted = true;
              }

              for (const vf of verifiedFiles) {
                const targetRemote = vf.remotePath || pkgEntry.originalPaths?.[0];
                if (!targetRemote) throw new Error(`Missing remote target path for system package ${pkgName}`);

                const targetDir = path.posix.dirname(targetRemote);
                // Create folder if Android 5.0+
                await adb.runAsRoot(serial, `mkdir -p "${targetDir}"`);
                await adb.runAsRoot(serial, `chmod 755 "${targetDir}"`).catch(() => {});

                // Push file
                await adb.execAdb(['-s', serial, 'push', vf.localPath, targetRemote]);

                // Chmod 644
                await adb.runAsRoot(serial, `chmod 644 "${targetRemote}"`);

                // Restorecon on Android 5.0+
                if (caps.apiLevel >= 21) {
                  await adb.runAsRoot(serial, `restorecon -R "${targetRemote}"`).catch(() => {});
                }
              }

              audit.log({
                serial,
                package: pkgName,
                action: 'restore_system',
                command: `pushed ${verifiedFiles.length} files to /system`,
                result: 'restored',
                status: 'success'
              });

            } else {
              // Restore user app via adb install -r
              const apkFiles = verifiedFiles.filter(f => !f.isOdex && f.localPath.endsWith('.apk'));
              if (apkFiles.length === 1) {
                await adb.execAdb(['-s', serial, 'install', '-r', apkFiles[0].localPath], { timeout: 300000 });
              } else if (apkFiles.length > 1) {
                const installArgs = ['-s', serial, 'install-multiple', '-r', ...apkFiles.map(f => f.localPath)];
                await adb.execAdb(installArgs, { timeout: 300000 });
              }

              audit.log({
                serial,
                package: pkgName,
                action: 'restore_user',
                command: `adb install -r ${pkgName}`,
                result: 'installed',
                status: 'success'
              });
            }

            results.push({ package: pkgName, action: 'restore', success: true });
            jobManager.sendEvent(jobId, {
              step: 'package_action',
              package: pkgName,
              status: 'done',
              message: `Restored ${pkgName} from backup.`,
              progress: { current: i + 1, total: totalPkgs }
            });
          }

        } catch (pkgErr) {
          audit.log({
            serial,
            package: pkgName,
            action,
            command: null,
            result: null,
            status: 'failed',
            error: pkgErr.message
          });

          results.push({ package: pkgName, action, success: false, error: pkgErr.message });
          jobManager.sendEvent(jobId, {
            step: 'package_action',
            package: pkgName,
            status: 'failed',
            error: pkgErr.message,
            message: `Failed on ${pkgName}: ${pkgErr.message}`,
            progress: { current: i + 1, total: totalPkgs }
          });
        }
      }

      // Sync and offer remount back ro
      if (systemRemounted) {
        await adb.runAsRoot(serial, 'sync').catch(() => {});
        // Attempt remount ro; harmless error ignored per spec
        await adb.runAsRoot(serial, 'mount -o remount,ro /system').catch(() => {});
      }

      // Invalidate scanner cache
      packageScanner.invalidateCache(serial);

      const summary = {
        action,
        total: packageNames.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success && r.status !== 'skipped').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        rebootRecommended,
        results
      };

      jobManager.completeJob(jobId, summary);
      return summary;

    } catch (err) {
      packageScanner.invalidateCache(serial);
      jobManager.failJob(jobId, err);
      throw err;
    }
  }

  /**
   * Install APKs through ADB
   */
  async installApks(serial, filePaths = [], options = {}) {
    if (!serial) throw new Error('Device serial is required.');
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error('No APK files provided for installation.');
    }

    const caps = await adb.getDeviceCapabilities(serial);

    // 1. Pre-flight space check: compare APK size with free space on /data
    let totalApkBytes = 0;
    for (const fp of filePaths) {
      if (fs.existsSync(fp)) {
        totalApkBytes += fs.statSync(fp).size;
      }
    }

    const dataFree = caps.freeSpace?.data?.freeBytes;
    if (dataFree && totalApkBytes > 0) {
      const requiredMargin = totalApkBytes * 2;
      if (dataFree < requiredMargin) {
        const freeMB = Math.round(dataFree / (1024 * 1024));
        const neededMB = Math.round(requiredMargin / (1024 * 1024));
        throw new Error(`Insufficient storage on phone: ${freeMB} MB free on /data, but ~${neededMB} MB is recommended for installation. (INSTALL_FAILED_INSUFFICIENT_STORAGE)`);
      }
    }

    // 2. Install as system app (root only) option
    if (options.installAsSystem) {
      if (!caps.rootAvailable) {
        throw new Error('Installing as a system app requires root privileges (su with uid=0).');
      }

      // Remount /system rw
      await adb.runAsRoot(serial, 'mount -o remount,rw /system');
      await adb.runAsRoot(serial, 'touch /system/.rwtest && rm -f /system/.rwtest');

      const installedFiles = [];
      for (const fp of filePaths) {
        const fileName = path.basename(fp);
        let remoteDest = `/system/app/${fileName}`;

        if (caps.apiLevel >= 21) {
          const folderName = fileName.replace(/\.apk$/i, '');
          const remoteFolder = `/system/app/${folderName}`;
          await adb.runAsRoot(serial, `mkdir -p "${remoteFolder}"`);
          await adb.runAsRoot(serial, `chmod 755 "${remoteFolder}"`);
          remoteDest = `${remoteFolder}/${fileName}`;
        }

        await adb.execAdb(['-s', serial, 'push', fp, remoteDest], { timeout: 300000 });
        await adb.runAsRoot(serial, `chmod 644 "${remoteDest}"`);
        if (caps.apiLevel >= 21) {
          await adb.runAsRoot(serial, `restorecon -R "${remoteDest}"`).catch(() => {});
        }
        installedFiles.push(remoteDest);
      }

      await adb.runAsRoot(serial, 'sync');
      await adb.runAsRoot(serial, 'mount -o remount,ro /system').catch(() => {});
      packageScanner.invalidateCache(serial);

      audit.log({
        serial,
        action: 'install_system_apk',
        command: `push to /system/app: ${installedFiles.join(', ')}`,
        result: 'success',
        status: 'success'
      });

      return {
        success: true,
        rebootRequired: true,
        message: 'Pushed APK(s) to /system/app. Reboot the phone to complete installation.',
        files: installedFiles
      };
    }

    // 3. Regular ADB install
    const flags = [];
    if (options.replace !== false) flags.push('-r'); // default ON
    if (options.downgrade) flags.push('-d');
    if (options.grantPermissions && caps.apiLevel >= 23) flags.push('-g');
    if (options.allowTest) flags.push('-t');

    try {
      let stdout = '';
      if (filePaths.length === 1) {
        // Single APK
        const installArgs = ['-s', serial, 'install', ...flags, filePaths[0]];
        const res = await adb.execAdb(installArgs, { timeout: 300000 });
        stdout = res.stdout;
      } else {
        // Split APKs
        const installArgs = ['-s', serial, 'install-multiple', ...flags, ...filePaths];
        const res = await adb.execAdb(installArgs, { timeout: 300000 });
        stdout = res.stdout;
      }

      if (stdout.includes('Success')) {
        packageScanner.invalidateCache(serial);
        audit.log({
          serial,
          action: 'install_apk',
          command: `adb install ${flags.join(' ')}`,
          result: 'Success',
          status: 'success'
        });

        return {
          success: true,
          message: 'Package installed successfully.',
          rawOutput: stdout
        };
      } else {
        const friendly = mapInstallError(stdout);
        audit.log({
          serial,
          action: 'install_apk',
          command: `adb install ${flags.join(' ')}`,
          result: stdout,
          status: 'failed',
          error: friendly
        });

        return {
          success: false,
          error: friendly,
          rawOutput: stdout
        };
      }
    } catch (err) {
      const combined = (err.stdout || '') + ' ' + (err.stderr || '') + ' ' + (err.message || '');
      const friendly = mapInstallError(combined);
      audit.log({
        serial,
        action: 'install_apk',
        command: `adb install`,
        result: combined,
        status: 'failed',
        error: friendly
      });

      return {
        success: false,
        error: friendly,
        rawOutput: combined.trim()
      };
    }
  }
}

module.exports = new PackageOperations();


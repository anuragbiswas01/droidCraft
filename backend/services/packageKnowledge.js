const fs = require('fs');
const path = require('path');

const KNOWLEDGE_PATH = path.join(__dirname, '..', 'data', 'knownPackages.json');

class PackageKnowledgeService {
  constructor() {
    this.knowledge = { packages: {}, patterns: [], dependencyGroups: {} };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(KNOWLEDGE_PATH)) {
        const raw = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
        this.knowledge = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[PackageKnowledge] Failed to load knownPackages.json:', err.message);
    }
  }

  /**
   * Look up information for a package
   * @param {string} pkgName
   * @returns {{ label: string, description: string, safety: 'essential' | 'caution' | 'safe' | 'unknown', group?: string }}
   */
  lookup(pkgName) {
    if (!pkgName) {
      return {
        label: 'Unknown',
        description: 'Not in the knowledge base. Back up before removing.',
        safety: 'unknown'
      };
    }

    // 1. Direct match
    if (this.knowledge.packages && this.knowledge.packages[pkgName]) {
      const match = this.knowledge.packages[pkgName];
      return {
        label: match.label || pkgName,
        description: match.description || '',
        safety: match.safety || 'unknown',
        group: match.group || undefined
      };
    }

    // 2. Pattern match
    if (Array.isArray(this.knowledge.patterns)) {
      for (const p of this.knowledge.patterns) {
        try {
          const re = new RegExp(p.pattern, 'i');
          if (re.test(pkgName)) {
            return {
              label: p.label || pkgName,
              description: p.description || '',
              safety: p.safety || 'unknown',
              group: p.group || undefined
            };
          }
        } catch (_) {}
      }
    }

    // 3. Fallback: derive friendly label from package name
    const parts = pkgName.split('.');
    const lastPart = parts[parts.length - 1] || pkgName;
    const readableLabel = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

    return {
      label: readableLabel,
      description: 'Not in the knowledge base. Back up before removing.',
      safety: 'unknown'
    };
  }

  /**
   * Check if a package is strictly protected from removal / disabling
   * @param {string} pkgName
   * @param {object} context - { activeLauncher, activeIme }
   * @returns {{ protected: boolean, reason?: string }}
   */
  isProtected(pkgName, context = {}) {
    if (!pkgName) return { protected: true, reason: 'Invalid package name' };

    // Core essential system packages
    const CORE_PROTECTED = new Set([
      'android',
      'com.android.systemui',
      'com.android.settings',
      'com.android.phone',
      'com.android.packageinstaller',
      'com.android.defcontainer',
      'com.android.keychain',
      'com.android.certinstaller',
      'com.android.shell',
      'com.android.inputmethod.latin',
      'com.android.location.fused',
      'com.mediatek'
    ]);

    if (CORE_PROTECTED.has(pkgName)) {
      return { protected: true, reason: `Essential core Android OS package (${pkgName}). Removal is prohibited.` };
    }

    // All android providers (com.android.providers.*)
    if (pkgName.startsWith('com.android.providers.')) {
      return { protected: true, reason: `Protected system content provider (${pkgName}). Removal is prohibited.` };
    }

    // Root managers
    const ROOT_MANAGERS = new Set([
      'eu.chainfire.supersu',
      'kingoroot.supersu',
      'com.topjohnwu.magisk',
      'com.koushikdutta.superuser',
      'com.noshufou.android.su'
    ]);

    if (ROOT_MANAGERS.has(pkgName)) {
      return { protected: true, reason: `Installed superuser root manager (${pkgName}). Removing would break root access.` };
    }

    // Active Home Launcher
    if (context.activeLauncher && context.activeLauncher === pkgName) {
      return { protected: true, reason: `Currently active Home Launcher (${pkgName}). Removing will leave device without a desktop UI.` };
    }

    // Active Keyboard / IME
    if (context.activeIme && context.activeIme === pkgName) {
      return { protected: true, reason: `Currently active Virtual Keyboard (${pkgName}). Removing will prevent text input.` };
    }

    // DroidCraft or Screen Mirror helper package
    if (pkgName.includes('droidcraft') || pkgName.startsWith('com.genymobile.scrcpy')) {
      return { protected: true, reason: `App controller component (${pkgName}).` };
    }

    return { protected: false };
  }

  /**
   * Find dependency group for a package
   * @param {string} pkgName
   */
  getDependencyGroup(pkgName) {
    if (!this.knowledge.dependencyGroups) return null;

    for (const [groupId, group] of Object.entries(this.knowledge.dependencyGroups)) {
      if (Array.isArray(group.packages) && group.packages.includes(pkgName)) {
        return {
          id: groupId,
          ...group
        };
      }
    }

    return null;
  }

  /**
   * Get all defined dependency groups
   */
  getAllDependencyGroups() {
    return this.knowledge.dependencyGroups || {};
  }
}

module.exports = new PackageKnowledgeService();


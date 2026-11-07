import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Package, 
  Search, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  Download, 
  PowerOff, 
  CheckCircle, 
  Trash2, 
  ArrowUpDown,
  Lock,
  Archive,
  Upload,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { api } from '../../services/api';
import PackageDetailsDrawer from './PackageDetailsDrawer';
import PackagePlanModal from './PackagePlanModal';
import JobProgressModal from './JobProgressModal';
import BackupsTab from './BackupsTab';
import InstallTab from './InstallTab';
import AuditLogTab from './AuditLogTab';

export default function PackagesView() {
  const { selectedSerial, capabilities, refreshCapabilities } = useDevice();

  // Primary subtab navigation: 'packages' | 'backups' | 'install' | 'audit'
  const [subTab, setSubTab] = useState('packages');

  // Packages data state
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(() => {
    return localStorage.getItem('dc_pkg_filter') || 'all';
  });
  const [sortField, setSortField] = useState(() => {
    return localStorage.getItem('dc_pkg_sort_field') || 'name';
  });
  const [sortAsc, setSortAsc] = useState(() => {
    return localStorage.getItem('dc_pkg_sort_asc') !== 'false';
  });

  // Selected packages for bulk action
  const [selectedNames, setSelectedNames] = useState(new Set());

  // Drawer & Modal states
  const [drawerPkg, setDrawerPkg] = useState(null);
  const [planAction, setPlanAction] = useState(null);
  const [planPackages, setPlanPackages] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);

  // Remember filter & sort in localStorage
  useEffect(() => {
    localStorage.setItem('dc_pkg_filter', activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    localStorage.setItem('dc_pkg_sort_field', sortField);
    localStorage.setItem('dc_pkg_sort_asc', String(sortAsc));
  }, [sortField, sortAsc]);

  // Load packages from backend
  const loadPackages = async (forceRefresh = false) => {
    if (!selectedSerial) return;
    setLoading(true);
    try {
      if (forceRefresh) {
        await refreshCapabilities(true);
      }
      const res = await api.getPackages(selectedSerial, forceRefresh);
      setPackages(res.packages || []);
      setSelectedNames(new Set());
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages(false);
  }, [selectedSerial]);

  // Category counts
  const counts = useMemo(() => {
    const res = {
      all: packages.length,
      system: 0,
      'system-updated': 0,
      user: 0,
      disabled: 0,
      protected: 0
    };
    packages.forEach(p => {
      if (p.category === 'system') res.system++;
      else if (p.category === 'system-updated') res['system-updated']++;
      else if (p.category === 'user') res.user++;

      if (!p.enabled) res.disabled++;
      if (p.protected) res.protected++;
    });
    return res;
  }, [packages]);

  // Filtered and sorted packages
  const displayedPackages = useMemo(() => {
    let list = packages.filter(p => {
      // 1. Filter Chip
      if (activeFilter === 'system' && p.category !== 'system') return false;
      if (activeFilter === 'system-updated' && p.category !== 'system-updated') return false;
      if (activeFilter === 'user' && p.category !== 'user') return false;
      if (activeFilter === 'disabled' && p.enabled) return false;
      if (activeFilter === 'protected' && !p.protected) return false;

      // 2. Search Box
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesLabel = p.knowledge?.label && p.knowledge.label.toLowerCase().includes(term);
        if (!matchesName && !matchesLabel) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'label') {
        valA = (a.knowledge?.label || a.name).toLowerCase();
        valB = (b.knowledge?.label || b.name).toLowerCase();
      } else if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'safety') {
        const safetyOrder = { essential: 4, caution: 3, unknown: 2, safe: 1 };
        valA = safetyOrder[a.knowledge?.safety || 'unknown'] || 0;
        valB = safetyOrder[b.knowledge?.safety || 'unknown'] || 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [packages, activeFilter, searchTerm, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Selection handlers
  const toggleSelect = (pkgName) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(pkgName)) next.delete(pkgName);
      else next.add(pkgName);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNames.size === displayedPackages.length && displayedPackages.length > 0) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(displayedPackages.map(p => p.name)));
    }
  };

  // Presets
  const applyPreset = (presetType) => {
    if (presetType === 'google-core') {
      const googlePkgs = packages
        .filter(p => !p.protected && p.knowledge?.group === 'google-core')
        .map(p => p.name);
      setSelectedNames(new Set(googlePkgs));
    } else if (presetType === 'safe-bloat') {
      const bloatPkgs = packages
        .filter(p => !p.protected && p.knowledge?.safety === 'safe' && (p.category === 'system' || p.category === 'system-updated'))
        .map(p => p.name);
      setSelectedNames(new Set(bloatPkgs));
    } else if (presetType === 'user') {
      const userPkgs = packages
        .filter(p => !p.protected && p.category === 'user')
        .map(p => p.name);
      setSelectedNames(new Set(userPkgs));
    } else if (presetType === 'clear') {
      setSelectedNames(new Set());
    }
  };

  // Trigger Plan Modal
  const openPlanModal = (action, targetPackages = null) => {
    const targets = targetPackages || Array.from(selectedNames);
    if (targets.length === 0) return;
    setPlanAction(action);
    setPlanPackages(targets);
  };

  // Execute Plan
  const handleExecutePlan = async (plan, options) => {
    setPlanAction(null);
    try {
      const res = await api.executePackagePlan(selectedSerial, {
        plan,
        options
      });
      if (res.jobId) {
        setActiveJobId(res.jobId);
      }
    } catch (err) {
      alert(`Execution failed: ${err.message}`);
    }
  };

  const handleJobFinish = useCallback(() => {
    loadPackages(true);
  }, [selectedSerial]);

  // Trigger quick backup of whole category
  const handleBackupCategory = async (category) => {
    const categoryPkgs = packages
      .filter(p => p.category === category)
      .map(p => p.name);

    if (categoryPkgs.length === 0) {
      alert(`No packages found in category "${category}".`);
      return;
    }

    try {
      const res = await api.backupPackages(selectedSerial, {
        packages: categoryPkgs
      });
      if (res.jobId) {
        setActiveJobId(res.jobId);
      }
    } catch (err) {
      alert(`Backup failed: ${err.message}`);
    }
  };

  // Restore from backup
  const handleRestoreFromBackup = (backupId, packageNames) => {
    openPlanModal('restore', packageNames);
  };

  // Check if any selected package is protected
  const selectedPackagesList = useMemo(() => {
    return packages.filter(p => selectedNames.has(p.name));
  }, [packages, selectedNames]);

  const hasProtectedSelected = selectedPackagesList.some(p => p.protected);
  const isRooted = !!capabilities?.rootAvailable;

  const dataFree = capabilities?.freeSpace?.data?.freeText;
  const sysFree = capabilities?.freeSpace?.system?.freeText;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">
                ADB Package Manager
              </h2>
              {/* Root Status Badge */}
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex items-center space-x-1 ${
                isRooted 
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
              }`}>
                <span>{isRooted ? '● Root Available' : '○ Non-Rooted'}</span>
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-zinc-500 mt-0.5">
              <span>{capabilities?.model || 'Device'}</span>
              <span>•</span>
              <span>Android {capabilities?.androidVersion || '4.x'}</span>
              {dataFree && (
                <>
                  <span>•</span>
                  <span>/data free: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{dataFree}</strong></span>
                </>
              )}
              {sysFree && (
                <>
                  <span>•</span>
                  <span>/system free: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{sysFree}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rescan & Navigation Tabs */}
        <div className="flex items-center space-x-2">
          {/* Subtabs Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium">
            <button
              onClick={() => setSubTab('packages')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                subTab === 'packages'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Packages ({packages.length})</span>
            </button>
            <button
              onClick={() => setSubTab('backups')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                subTab === 'backups'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Backups</span>
            </button>
            <button
              onClick={() => setSubTab('install')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                subTab === 'install'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Install APK</span>
            </button>
            <button
              onClick={() => setSubTab('audit')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                subTab === 'audit'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Log</span>
            </button>
          </div>

          {/* Rescan Button */}
          <button
            onClick={() => loadPackages(true)}
            disabled={loading}
            title="Rescan device packages and storage"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>
        </div>
      </div>

      {/* View Router */}
      {subTab === 'backups' ? (
        <BackupsTab
          serial={selectedSerial}
          capabilities={capabilities}
          onRestoreBackup={handleRestoreFromBackup}
          onBackupCategory={handleBackupCategory}
        />
      ) : subTab === 'install' ? (
        <InstallTab
          serial={selectedSerial}
          capabilities={capabilities}
          onInstallSuccess={() => loadPackages(true)}
        />
      ) : subTab === 'audit' ? (
        <AuditLogTab serial={selectedSerial} />
      ) : (
        /* Primary Packages Tab */
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
          {/* Filters, Presets & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg border transition font-medium ${
                  activeFilter === 'all'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                All <span className="opacity-70 ml-1 font-mono text-[11px]">{counts.all}</span>
              </button>

              <button
                onClick={() => setActiveFilter('system')}
                className={`px-2.5 py-1 rounded-lg border transition font-medium ${
                  activeFilter === 'system'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                System <span className="opacity-70 ml-1 font-mono text-[11px]">{counts.system}</span>
              </button>

              <button
                onClick={() => setActiveFilter('system-updated')}
                className={`px-2.5 py-1 rounded-lg border transition font-medium ${
                  activeFilter === 'system-updated'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                System (Updated) <span className="opacity-70 ml-1 font-mono text-[11px]">{counts['system-updated']}</span>
              </button>

              <button
                onClick={() => setActiveFilter('user')}
                className={`px-2.5 py-1 rounded-lg border transition font-medium ${
                  activeFilter === 'user'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                User / 3rd Party <span className="opacity-70 ml-1 font-mono text-[11px]">{counts.user}</span>
              </button>

              <button
                onClick={() => setActiveFilter('disabled')}
                className={`px-2.5 py-1 rounded-lg border transition font-medium ${
                  activeFilter === 'disabled'
                    ? 'bg-zinc-700 text-white border-zinc-700'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                Disabled <span className="opacity-70 ml-1 font-mono text-[11px]">{counts.disabled}</span>
              </button>

              <button
                onClick={() => setActiveFilter('protected')}
                className={`px-2.5 py-1 rounded-lg border transition font-medium ${
                  activeFilter === 'protected'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                Protected <span className="opacity-70 ml-1 font-mono text-[11px]">{counts.protected}</span>
              </button>
            </div>

            {/* Presets & Search */}
            <div className="flex items-center space-x-2">
              {/* Presets dropdown / pill buttons */}
              <div className="hidden sm:flex items-center space-x-1 text-[11px]">
                <button
                  onClick={() => applyPreset('google-core')}
                  className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 transition"
                >
                  Select Google Core
                </button>
                <button
                  onClick={() => applyPreset('safe-bloat')}
                  className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 transition"
                >
                  Select Safe Bloat
                </button>
                {selectedNames.size > 0 && (
                  <button
                    onClick={() => applyPreset('clear')}
                    className="px-2 py-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    Clear ({selectedNames.size})
                  </button>
                )}
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Search package or app name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-white dark:bg-zinc-900 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none w-56 focus:border-zinc-400"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs relative">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950/90 backdrop-blur-xs border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 font-medium">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedNames.size === displayedPackages.length && displayedPackages.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
                    />
                  </th>
                  <th 
                    onClick={() => toggleSort('label')}
                    className="p-3 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Application</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('name')}
                    className="p-3 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 hidden md:table-cell"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Package Identifier</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort('category')}
                    className="p-3 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <span>Category</span>
                  </th>
                  <th 
                    onClick={() => toggleSort('enabled')}
                    className="p-3 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <span>Status</span>
                  </th>
                  <th 
                    onClick={() => toggleSort('safety')}
                    className="p-3 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <span>Safety</span>
                  </th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loading && packages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-2" />
                      <p>Scanning installed packages...</p>
                    </td>
                  </tr>
                ) : displayedPackages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                      <p>No matching packages found.</p>
                    </td>
                  </tr>
                ) : (
                  displayedPackages.map(pkg => {
                    const isSelected = selectedNames.has(pkg.name);
                    const safety = pkg.knowledge?.safety || 'unknown';

                    return (
                      <tr
                        key={pkg.name}
                        onClick={() => setDrawerPkg(pkg)}
                        className={`cursor-pointer transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                          isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <td 
                          className="p-3 text-center" 
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(pkg.name)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
                          />
                        </td>

                        {/* App Label */}
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                              {pkg.knowledge?.label || pkg.name}
                            </span>
                            {pkg.protected && (
                              <Lock className="w-3 h-3 text-red-500 shrink-0" title="Protected: removal blocked" />
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-zinc-400 block md:hidden truncate max-w-xs">
                            {pkg.name}
                          </span>
                        </td>

                        {/* Package Name */}
                        <td className="p-3 font-mono text-[11px] text-zinc-500 hidden md:table-cell truncate max-w-xs">
                          {pkg.name}
                        </td>

                        {/* Category */}
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            pkg.category === 'user' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300' :
                            pkg.category === 'system-updated' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' :
                            'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
                          }`}>
                            {pkg.category === 'user' ? 'User' :
                             pkg.category === 'system-updated' ? 'System (Updated)' : 'System'}
                          </span>
                        </td>

                        {/* Status (Enabled/Disabled) */}
                        <td className="p-3">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            pkg.enabled
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {pkg.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>

                        {/* Safety */}
                        <td className="p-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize flex items-center space-x-1 w-fit ${
                            safety === 'essential' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            safety === 'caution' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                            safety === 'safe' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {safety === 'essential' ? <ShieldAlert className="w-3 h-3 text-red-500" /> :
                             safety === 'caution' ? <AlertTriangle className="w-3 h-3 text-amber-500" /> :
                             safety === 'safe' ? <ShieldCheck className="w-3 h-3 text-emerald-500" /> :
                             <Shield className="w-3 h-3 text-zinc-400" />}
                            <span>{safety}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setDrawerPkg(pkg)}
                            className="px-2 py-0.5 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bulk Action Toolbar (Floating when packages selected) */}
          {selectedNames.size > 0 && (
            <div className="shrink-0 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono">
                  {selectedNames.size} Selected
                </span>
                {hasProtectedSelected && (
                  <span className="text-[11px] text-red-600 dark:text-red-400 flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Protected packages selected (removal disabled)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Backup */}
                <button
                  onClick={() => openPlanModal('backup')}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup ({selectedNames.size})</span>
                </button>

                {/* Disable */}
                <button
                  disabled={hasProtectedSelected}
                  onClick={() => openPlanModal('disable')}
                  title={hasProtectedSelected ? 'Cannot disable protected packages' : ''}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-800 dark:text-amber-200 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  <span>Disable</span>
                </button>

                {/* Enable */}
                <button
                  onClick={() => openPlanModal('enable')}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs font-medium transition"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Enable</span>
                </button>

                {/* Uninstall */}
                <button
                  disabled={hasProtectedSelected}
                  onClick={() => openPlanModal('uninstall')}
                  title={hasProtectedSelected ? 'Cannot uninstall protected packages' : ''}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Uninstall</span>
                </button>

                {/* Delete Permanently (Root only) */}
                <button
                  disabled={hasProtectedSelected || !isRooted}
                  onClick={() => openPlanModal('delete')}
                  title={!isRooted ? 'Device is not rooted (su unavailable)' : hasProtectedSelected ? 'Cannot delete protected packages' : ''}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Permanently (Root)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Package Details Drawer */}
      <PackageDetailsDrawer
        serial={selectedSerial}
        pkg={drawerPkg}
        isOpen={!!drawerPkg}
        onClose={() => setDrawerPkg(null)}
        onActionClick={(action, names) => {
          setDrawerPkg(null);
          openPlanModal(action, names);
        }}
        capabilities={capabilities}
      />

      {/* Package Plan Modal */}
      <PackagePlanModal
        isOpen={!!planAction}
        onClose={() => setPlanAction(null)}
        serial={selectedSerial}
        action={planAction}
        packages={planPackages}
        capabilities={capabilities}
        onExecute={handleExecutePlan}
      />

      {/* Job Progress Modal */}
      <JobProgressModal
        isOpen={!!activeJobId}
        onClose={() => {
          setActiveJobId(null);
          loadPackages(true);
        }}
        serial={selectedSerial}
        jobId={activeJobId}
        onJobComplete={handleJobFinish}
        onDeviceReboot={handleJobFinish}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { 
  Palette, 
  Laptop, 
  Smartphone, 
  Video, 
  Bell, 
  Folder, 
  Zap, 
  FileText, 
  Wifi, 
  Check, 
  Sparkles, 
  RotateCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Music
} from 'lucide-react';
import { useTheme, THEME_PRESETS, ACCENT_COLORS } from '../../context/ThemeContext';
import { useDevice } from '../../context/DeviceContext';
import { api } from '../../services/api';

export default function AppearanceSettings() {
  const [subSection, setSubSection] = useState('appearance');
  const { 
    themePreset, 
    setThemePreset, 
    mode, 
    setMode, 
    accentColor, 
    setAccentColor,
    micaBackdrop,
    setMicaBackdrop
  } = useTheme();

  const { 
    deviceInfo, 
    capabilities, 
    selectedSerial, 
    networkInfo,
    scrcpyAvailable,
    scrcpyVersion 
  } = useDevice();

  const [copiedLan, setCopiedLan] = useState(false);

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'general', label: 'General', icon: Laptop },
    { id: 'devices', label: 'Devices', icon: Smartphone, badge: '1' },
    { id: 'camera', label: 'Camera & Audio', icon: Video },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'files', label: 'Files & Sync', icon: Folder },
    { id: 'shortcuts', label: 'Shortcuts & Rules', icon: Zap },
    { id: 'storage', label: 'Storage & Privacy', icon: FileText },
    { id: 'about', label: 'Connection & About', icon: Wifi },
  ];

  const primaryLan = networkInfo?.networkUrls?.[0]?.url || null;

  const handleCopyLan = () => {
    if (!primaryLan) return;
    navigator.clipboard.writeText(primaryLan);
    setCopiedLan(true);
    setTimeout(() => setCopiedLan(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full p-4 md:p-6 gap-6">
      {/* Settings Left Rail */}
      <div className="w-full md:w-60 shrink-0 space-y-1 select-none">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] mb-4 px-2">
          Settings
        </h2>

        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-1 pb-2 md:pb-0">
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = subSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSubSection(s.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all whitespace-nowrap md:w-full ${
                  isActive
                    ? 'shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
                style={isActive ? {
                  backgroundColor: 'var(--bg-surface-subtle)',
                  color: 'var(--text-primary)'
                } : {}}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`} />
                  <span>{s.label}</span>
                </div>
                {s.badge && (
                  <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {s.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Content Area */}
      <div className="flex-1 overflow-y-auto dc-card p-6 md:p-8 shadow-xs space-y-8">
        {subSection === 'appearance' ? (
          <>
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Appearance</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Customize themes, interface styling, and colors in real-time.
              </p>
            </div>

            {/* 1. Theme Presets */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Theme</span>
                </span>

                <div className="flex items-center bg-[var(--bg-surface-subtle)] p-1 rounded-2xl border border-[var(--border-subtle)]">
                  {THEME_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setThemePreset(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                        themePreset === p.id
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Color Mode */}
            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Mode</span>
                </span>

                <div className="flex items-center bg-[var(--bg-surface-subtle)] p-1 rounded-2xl border border-[var(--border-subtle)]">
                  {['system', 'light', 'dark'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                        mode === m
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Accent Color Swatches */}
            <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Color</span>
                </span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Pick a system accent color or select your own custom shade.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {ACCENT_COLORS.map(c => {
                  const isSelected = accentColor.toLowerCase() === c.color.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      onClick={() => setAccentColor(c.color)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-xs ${
                        isSelected ? 'ring-3 ring-offset-2 ring-[var(--accent-color)] scale-105' : ''
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}

                {/* Custom Color Picker Swatch */}
                <label 
                  className="w-9 h-9 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xs overflow-hidden"
                  title="Pick custom color"
                >
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="opacity-0 w-0 h-0 cursor-pointer"
                  />
                  <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
                </label>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => setAccentColor('#b8493d')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-color)] transition"
                >
                  <Music className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>Media artwork</span>
                </button>
                <button
                  onClick={() => setAccentColor('#d9654c')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-color)] transition"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>Phone colors</span>
                </button>
              </div>
            </div>

            {/* 4. Mica Backdrop Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Mica backdrop</span>
                </span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Tint window with translucent wallpaper blur effect.
                </p>
              </div>

              <button
                onClick={() => setMicaBackdrop(!micaBackdrop)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  micaBackdrop ? 'bg-[var(--accent-color)]' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span 
                  className={`w-5 h-5 rounded-full bg-white shadow-xs block transition-transform ${
                    micaBackdrop ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </>
        ) : subSection === 'devices' ? (
          /* Devices Pane */
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Connected Devices</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Manage connected Android hardware via ADB and scrcpy.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl text-white" style={{ backgroundColor: 'var(--accent-color)' }}>
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      {capabilities?.model || deviceInfo?.model || 'Android Device'}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] font-mono">
                      {selectedSerial}
                    </p>
                  </div>
                </div>

                {capabilities?.rootAvailable && (
                  <span className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Rooted</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Android</span>
                  <span className="font-semibold text-[var(--text-primary)]">{capabilities?.release || '4.4.2'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">API Level</span>
                  <span className="font-semibold text-[var(--text-primary)]">{capabilities?.sdk || '19'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">CPU ABI</span>
                  <span className="font-semibold text-[var(--text-primary)]">{capabilities?.abi || 'armeabi-v7a'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Control Mode</span>
                  <span className="font-semibold text-[var(--text-primary)]">Auto (Legacy ADB)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Connection & About Pane */
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Connection & Network</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Access this instance across your local Wi-Fi network.
              </p>
            </div>

            {primaryLan && (
              <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Local Wi-Fi Network Access</h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">Open this URL on phones, tablets, or other PCs on the same Wi-Fi</p>
                  </div>
                  <button
                    onClick={handleCopyLan}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs"
                    style={{ backgroundColor: 'var(--accent-color)' }}
                  >
                    {copiedLan ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLan ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
                <code className="block p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] select-all">
                  {primaryLan}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


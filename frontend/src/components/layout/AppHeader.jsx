import React, { useState } from 'react';
import { 
  RotateCw, 
  Search, 
  History, 
  Palette, 
  Maximize2, 
  Minimize2, 
  Wifi, 
  Smartphone,
  ChevronDown,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { useTheme, THEME_PRESETS, ACCENT_COLORS } from '../../context/ThemeContext';

export default function AppHeader({ onToggleCommands, onToggleTimeline }) {
  const { 
    devices, 
    selectedSerial, 
    setSelectedSerial, 
    refreshDevices, 
    activeTab, 
    deviceInfo 
  } = useDevice();

  const { 
    themePreset, 
    setThemePreset, 
    mode, 
    setMode, 
    accentColor, 
    setAccentColor 
  } = useTheme();

  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Tab Title mapping
  const titleMap = {
    home: 'Home',
    mirror: 'Screen Mirroring',
    controller: 'Screen Mirroring',
    apps: 'Apps & Packages',
    packages: 'Apps & Packages',
    system: 'System & Diagnostics',
    deck: 'Hardware Deck',
    settings: 'Settings'
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="h-14 px-4 md:px-6 flex items-center justify-between bg-[var(--bg-base)] select-none shrink-0 transition-colors">
      {/* Left: View Title & Device Chip */}
      <div className="flex items-center space-x-3">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-[var(--text-primary)]">
          {titleMap[activeTab] || 'Home'}
        </h1>

        {/* Device Picker Pill */}
        <div className="relative flex items-center">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <select
              value={selectedSerial || ''}
              onChange={(e) => setSelectedSerial(e.target.value)}
              className="bg-transparent font-medium outline-none cursor-pointer pr-1 text-xs"
            >
              {devices.length === 0 ? (
                <option value="">No device</option>
              ) : (
                devices.map((d) => (
                  <option key={d.serial} value={d.serial} className="text-zinc-900 bg-white">
                    {d.model || d.serial}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quick Rescan */}
          <button
            onClick={refreshDevices}
            title="Scan ADB Devices"
            className="ml-1 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Utility Controls */}
      <div className="flex items-center space-x-1.5 md:space-x-2">
        {/* Commands Button */}
        <button
          onClick={onToggleCommands}
          className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs shadow-2xs transition"
          title="Command Palette"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Commands</span>
        </button>

        {/* Timeline Button */}
        <button
          onClick={onToggleTimeline}
          className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs shadow-2xs transition"
          title="Recent Activity Timeline"
        >
          <History className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Timeline</span>
        </button>

        {/* Quick Theme Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs shadow-2xs transition"
            title="Customize Theme & Color"
          >
            <span 
              className="w-3 h-3 rounded-full shrink-0 shadow-2xs" 
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
            <span className="hidden md:inline text-[11px] font-medium capitalize">{themePreset}</span>
            <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
          </button>

          {/* Dropdown Quick Theme & Color Swatches */}
          {isColorMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-64 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Presets */}
              <div>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                  Theme Style
                </span>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {THEME_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setThemePreset(p.id)}
                      className={`px-2 py-1 rounded-lg border text-left font-medium transition ${
                        themePreset === p.id
                          ? 'border-[var(--accent-color)] text-white'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]'
                      }`}
                      style={themePreset === p.id ? { backgroundColor: 'var(--accent-color)' } : {}}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color Swatches */}
              <div>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
                  Accent Color
                </span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setAccentColor(c.color)}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                        accentColor.toLowerCase() === c.color.toLowerCase() ? 'ring-2 ring-offset-2 ring-[var(--accent-color)] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                  {/* Custom Color Input */}
                  <label 
                    className="w-6 h-6 rounded-full border border-dashed border-[var(--border-subtle)] flex items-center justify-center cursor-pointer hover:scale-110 transition overflow-hidden"
                    title="Custom color"
                  >
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="opacity-0 w-0 h-0 cursor-pointer"
                    />
                    <Sparkles className="w-3 h-3 text-[var(--text-secondary)]" />
                  </label>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-xs">
                <span className="text-[11px] text-[var(--text-secondary)]">Mode</span>
                <div className="flex items-center space-x-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
                  <button
                    onClick={() => setMode('light')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                      mode === 'light' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setMode('dark')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                      mode === 'dark' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className="p-1.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-2xs transition"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}


import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const ThemeContext = createContext();

export const THEME_PRESETS = [
  { id: 'bloom', label: 'Bloom', desc: 'Warm peach & blush tones' },
  { id: 'glass', label: 'Glass', desc: 'Frosted translucent backdrop' },
  { id: 'graphite', label: 'Graphite', desc: 'Sleek neutral aesthetic' },
  { id: 'hive-dark', label: 'Hive Dark', desc: 'Deep black with amber glow' },
  { id: 'hive-light', label: 'Hive Light', desc: 'Crisp minimalist white' }
];

export const ACCENT_COLORS = [
  { id: 'terracotta', label: 'Terracotta', color: '#b8493d', text: '#ffffff' },
  { id: 'peach', label: 'Peach', color: '#d9654c', text: '#ffffff' },
  { id: 'midnight', label: 'Midnight', color: '#1e293b', text: '#ffffff' },
  { id: 'amber', label: 'Amber', color: '#d97706', text: '#ffffff' },
  { id: 'lavender', label: 'Lavender', color: '#7c3aed', text: '#ffffff' },
  { id: 'ocean', label: 'Ocean', color: '#0284c7', text: '#ffffff' },
  { id: 'emerald', label: 'Emerald', color: '#059669', text: '#ffffff' },
  { id: 'charcoal', label: 'Charcoal', color: '#334155', text: '#ffffff' }
];

export function ThemeProvider({ children }) {
  // Theme Preset
  const [themePreset, setThemePreset] = useState(() => {
    return localStorage.getItem('dc_theme_preset') || 'bloom';
  });

  // Color Mode: 'light' | 'dark' | 'system'
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('dc_theme_mode') || 'light';
  });

  // Custom Accent Color
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('dc_accent_color') || '#b8493d';
  });

  // Mica Backdrop blur toggle
  const [micaBackdrop, setMicaBackdrop] = useState(() => {
    return localStorage.getItem('dc_mica_backdrop') !== 'false';
  });

  // Determine actual light/dark based on mode
  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [mode]);

  // Apply theme variables to :root
  useEffect(() => {
    const root = document.documentElement;

    // Dark class for tailwind
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Set theme preset class
    THEME_PRESETS.forEach(p => root.classList.remove(`theme-${p.id}`));
    root.classList.add(`theme-${themePreset}`);

    // Palette Definitions
    let bgBase = '#fcf2f0';
    let bgSurface = '#ffffff';
    let bgSurfaceElevated = '#ffffff';
    let bgSurfaceSubtle = '#fcedeb';
    let borderSubtle = '#f5deda';
    let textPrimary = '#3b2220';
    let textSecondary = '#8f6863';

    if (themePreset === 'bloom') {
      if (isDark) {
        bgBase = '#1c1413';
        bgSurface = '#261b1a';
        bgSurfaceElevated = '#332423';
        bgSurfaceSubtle = '#3d2b29';
        borderSubtle = '#4d3634';
        textPrimary = '#faecea';
        textSecondary = '#bfa5a2';
      } else {
        bgBase = '#fcf2f0';
        bgSurface = '#fff7f6';
        bgSurfaceElevated = '#ffffff';
        bgSurfaceSubtle = '#fae9e6';
        borderSubtle = '#f3deda';
        textPrimary = '#3d2320';
        textSecondary = '#8a6560';
      }
    } else if (themePreset === 'glass') {
      if (isDark) {
        bgBase = '#121216';
        bgSurface = 'rgba(28, 28, 36, 0.75)';
        bgSurfaceElevated = 'rgba(38, 38, 48, 0.85)';
        bgSurfaceSubtle = 'rgba(48, 48, 62, 0.6)';
        borderSubtle = 'rgba(255, 255, 255, 0.1)';
        textPrimary = '#f3f4f6';
        textSecondary = '#9ca3af';
      } else {
        bgBase = '#f4f4f8';
        bgSurface = 'rgba(255, 255, 255, 0.75)';
        bgSurfaceElevated = 'rgba(255, 255, 255, 0.9)';
        bgSurfaceSubtle = 'rgba(240, 240, 245, 0.8)';
        borderSubtle = 'rgba(255, 255, 255, 0.6)';
        textPrimary = '#1e1e24';
        textSecondary = '#6b7280';
      }
    } else if (themePreset === 'graphite') {
      if (isDark) {
        bgBase = '#161618';
        bgSurface = '#1f1f23';
        bgSurfaceElevated = '#2a2a30';
        bgSurfaceSubtle = '#33333b';
        borderSubtle = '#3d3d47';
        textPrimary = '#f1f1f4';
        textSecondary = '#a1a1aa';
      } else {
        bgBase = '#f3efe6';
        bgSurface = '#fffdf9';
        bgSurfaceElevated = '#ffffff';
        bgSurfaceSubtle = '#eae5dc';
        borderSubtle = '#dfd9cf';
        textPrimary = '#27272a';
        textSecondary = '#71717a';
      }
    } else if (themePreset === 'hive-dark') {
      bgBase = '#121212';
      bgSurface = '#1a1a1a';
      bgSurfaceElevated = '#242424';
      bgSurfaceSubtle = '#2c2c2c';
      borderSubtle = '#383838';
      textPrimary = '#f5f5f5';
      textSecondary = '#a3a3a3';
    } else if (themePreset === 'hive-light') {
      bgBase = '#f8fafc';
      bgSurface = '#ffffff';
      bgSurfaceElevated = '#ffffff';
      bgSurfaceSubtle = '#f1f5f9';
      borderSubtle = '#e2e8f0';
      textPrimary = '#0f172a';
      textSecondary = '#64748b';
    }

    // Set CSS custom properties
    root.style.setProperty('--bg-base', bgBase);
    root.style.setProperty('--bg-surface', bgSurface);
    root.style.setProperty('--bg-surface-elevated', bgSurfaceElevated);
    root.style.setProperty('--bg-surface-subtle', bgSurfaceSubtle);
    root.style.setProperty('--border-subtle', borderSubtle);
    root.style.setProperty('--text-primary', textPrimary);
    root.style.setProperty('--text-secondary', textSecondary);
    root.style.setProperty('--accent-color', accentColor);
    root.style.setProperty('--accent-fg', '#ffffff');

    // Persistence
    localStorage.setItem('dc_theme_preset', themePreset);
    localStorage.setItem('dc_theme_mode', mode);
    localStorage.setItem('dc_accent_color', accentColor);
    localStorage.setItem('dc_mica_backdrop', String(micaBackdrop));
  }, [themePreset, mode, isDark, accentColor, micaBackdrop]);

  return (
    <ThemeContext.Provider value={{
      themePreset,
      setThemePreset,
      mode,
      setMode,
      isDark,
      accentColor,
      setAccentColor,
      micaBackdrop,
      setMicaBackdrop,
      // Compatibility helpers
      theme: isDark ? 'dark' : 'light',
      toggleTheme: () => setMode(prev => prev === 'dark' ? 'light' : 'dark')
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

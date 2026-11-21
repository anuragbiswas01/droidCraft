import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Smartphone, 
  LayoutGrid, 
  Cpu, 
  Sliders, 
  Settings, 
  Plus, 
  Infinity as InfinityIcon
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';

export default function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setActiveTab } = useDevice();

  const navItems = [
    { id: 'home', path: '/', label: 'Home', icon: Home },
    { id: 'mirror', path: '/mirror', label: 'Screen', icon: Smartphone },
    { id: 'apps', path: '/apps', label: 'Apps', icon: LayoutGrid },
    { id: 'system', path: '/system', label: 'System', icon: Cpu },
    { id: 'deck', path: '/deck', label: 'Deck', icon: Sliders },
    { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
  ];

  const isNavActive = (item) => {
    if (item.path === '/') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname === item.path ||
      location.pathname.startsWith(item.path + '/') ||
      (item.id === 'mirror' && location.pathname.startsWith('/controller')) ||
      (item.id === 'apps' && location.pathname.startsWith('/packages'));
  };

  const handleNavigate = (item) => {
    navigate(item.path);
    setActiveTab(item.id);
  };

  return (
    <>
      {/* Desktop Vertical Sidebar Rail */}
      <aside className="hidden md:flex flex-col items-center justify-between w-20 py-4 px-2 shrink-0 bg-[var(--bg-base)] select-none">
        {/* Brand Logo Button */}
        <div className="flex flex-col items-center space-y-4">
          <button 
            onClick={() => handleNavigate(navItems[0])}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'var(--accent-color)' }}
            title="DroidCraft Home"
          >
            <InfinityIcon className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Nav Items */}
          <nav className="flex flex-col items-center space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavActive(item);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item)}
                  className={`w-16 py-2 px-1 flex flex-col items-center justify-center rounded-2xl text-[11px] font-medium transition-all duration-200 group relative ${
                    isActive
                      ? 'shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                  style={isActive ? {
                    backgroundColor: 'var(--bg-surface-subtle)',
                    color: 'var(--text-primary)'
                  } : {}}
                  title={item.label}
                >
                  {/* Active Indicator Pill */}
                  {isActive && (
                    <span 
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                      style={{ backgroundColor: 'var(--accent-color)' }}
                    />
                  )}
                  <div 
                    className={`p-1.5 rounded-xl transition-colors ${
                      isActive ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                    }`}
                    style={isActive ? { backgroundColor: 'var(--accent-color)' } : {}}
                  >
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="mt-1 text-[10px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Quick Action Plus Button */}
        <button
          onClick={() => handleNavigate(navItems[5])}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-xs transition-transform hover:scale-105 active:scale-95"
          title="Customize & Add"
        >
          <Plus className="w-5 h-5 stroke-[2]" />
        </button>
      </aside>

      {/* Mobile Floating Bottom Dock (matching android-home.png) */}
      <nav className="md:hidden fixed bottom-3 left-4 right-4 z-40 h-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl backdrop-blur-xl flex items-center justify-around px-2 select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(item);

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={isActive ? { backgroundColor: 'var(--accent-color)' } : {}}
            >
              <Icon className="w-4 h-4 stroke-[2.2]" />
              {isActive && <span className="text-[11px] tracking-tight">{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </>
  );
}

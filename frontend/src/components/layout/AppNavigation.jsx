import React from 'react';
import { 
  Home, 
  Smartphone, 
  LayoutGrid, 
  Cpu, 
  Sliders, 
  Settings, 
  Plus, 
  Infinity as InfinityIcon,
  MessageSquare,
  Phone,
  Image as ImageIcon
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';

export default function AppNavigation() {
  const { activeTab, setActiveTab } = useDevice();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'mirror', label: 'Screen', icon: Smartphone },
    { id: 'apps', label: 'Apps', icon: LayoutGrid },
    { id: 'system', label: 'System', icon: Cpu },
    { id: 'deck', label: 'Deck', icon: Sliders },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Vertical Sidebar Rail */}
      <aside className="hidden md:flex flex-col items-center justify-between w-20 py-4 px-2 shrink-0 bg-[var(--bg-base)] select-none">
        {/* Brand Logo Button */}
        <div className="flex flex-col items-center space-y-4">
          <button 
            onClick={() => setActiveTab('home')}
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
              const isActive = activeTab === item.id || 
                (item.id === 'mirror' && activeTab === 'controller') ||
                (item.id === 'apps' && activeTab === 'packages');

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
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
          onClick={() => setActiveTab('settings')}
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
          const isActive = activeTab === item.id || 
            (item.id === 'mirror' && activeTab === 'controller') ||
            (item.id === 'apps' && activeTab === 'packages');

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
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


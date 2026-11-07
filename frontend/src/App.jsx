import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { DeviceProvider, useDevice } from './context/DeviceContext';
import AppNavigation from './components/layout/AppNavigation';
import AppHeader from './components/layout/AppHeader';
import HomeDashboard from './components/dashboard/HomeDashboard';
import PhoneViewport from './components/PhoneViewport';
import SidebarControls from './components/SidebarControls';
import QuickSettingsSheet from './components/QuickSettingsSheet';
import PackagesView from './components/packages/PackagesView';
import SystemView from './components/system/SystemView';
import AppearanceSettings from './components/settings/AppearanceSettings';

function MainController() {
  const { activeTab } = useDevice();
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors">
      {/* Left Vertical Nav Rail (desktop) & Floating Bottom Pill Dock (mobile) */}
      <AppNavigation />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header */}
        <AppHeader />

        {/* View Switcher Stage */}
        <main className="flex-1 flex overflow-hidden relative">
          {activeTab === 'home' ? (
            <HomeDashboard />
          ) : activeTab === 'mirror' || activeTab === 'controller' ? (
            <div className="flex-1 flex h-full overflow-hidden">
              <div className="flex-1 h-full overflow-hidden relative p-3 md:p-6 flex items-center justify-center">
                <div className="h-full max-h-[88vh] aspect-[9/16] dc-card overflow-hidden shadow-2xl p-1.5 md:p-2.5 relative flex items-center justify-center bg-zinc-950 border-2 border-zinc-700/60 rounded-3xl">
                  <PhoneViewport onOpenQuickSettings={() => setIsQuickSettingsOpen(true)} />
                </div>
              </div>

              {/* Desktop Hardware Sidebar */}
              <aside className="hidden lg:block h-full border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <SidebarControls />
              </aside>
            </div>
          ) : activeTab === 'apps' || activeTab === 'packages' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
              <PackagesView />
            </div>
          ) : activeTab === 'system' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
              <SystemView />
            </div>
          ) : activeTab === 'deck' ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-xl mx-auto w-full">
              <div className="dc-card p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-base text-[var(--text-primary)] tracking-tight">Remote Deck Controls</h3>
                <SidebarControls />
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <AppearanceSettings />
          ) : (
            <HomeDashboard />
          )}

          {/* Mobile Quick Settings Bottom Sheet / Drawer */}
          <QuickSettingsSheet
            isOpen={isQuickSettingsOpen}
            onClose={() => setIsQuickSettingsOpen(false)}
          />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DeviceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainController />} />
            <Route path="*" element={<MainController />} />
          </Routes>
        </BrowserRouter>
      </DeviceProvider>
    </ThemeProvider>
  );
}

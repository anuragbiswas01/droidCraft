import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { DeviceProvider } from './context/DeviceContext';
import Header from './components/Header';
import PhoneViewport from './components/PhoneViewport';
import SidebarControls from './components/SidebarControls';
import MobileOverlayFab from './components/MobileOverlayFab';
import QuickSettingsSheet from './components/QuickSettingsSheet';
import SettingsModal from './components/SettingsModal';

function MainController() {
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      {/* Header (Hidden on pure mobile fullscreen if desired, or compact) */}
      <Header onOpenSettings={() => setIsSettingsModalOpen(true)} />

      {/* Main Workspace Stage */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Phone Mirror (Fullscreen on mobile, framed on desktop) */}
        <div className="flex-1 h-full overflow-hidden relative">
          <PhoneViewport onOpenQuickSettings={() => setIsQuickSettingsOpen(true)} />
        </div>

        {/* Desktop Sidebar Controls */}
        <aside className="hidden md:block h-full">
          <SidebarControls />
        </aside>

        {/* Mobile Draggable Floating Overlay Action Button (FAB) */}
        <MobileOverlayFab onClick={() => setIsQuickSettingsOpen(true)} />

        {/* Mobile Quick Settings Bottom Sheet / Drawer */}
        <QuickSettingsSheet
          isOpen={isQuickSettingsOpen}
          onClose={() => setIsQuickSettingsOpen(false)}
        />

        {/* Global Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </main>
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

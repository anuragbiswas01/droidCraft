import React from 'react';
import { Outlet } from 'react-router-dom';
import AppNavigation from './AppNavigation';
import AppHeader from './AppHeader';

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors">
      {/* Left Vertical Nav Rail (desktop) & Floating Bottom Pill Dock (mobile) */}
      <AppNavigation />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header */}
        <AppHeader />

        {/* Page Content Outlet */}
        <main className="flex-1 flex overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

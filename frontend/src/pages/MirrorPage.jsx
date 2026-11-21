import React, { useState } from 'react';
import PhoneViewport from '../components/PhoneViewport';
import SidebarControls from '../components/SidebarControls';
import QuickSettingsSheet from '../components/QuickSettingsSheet';

export default function MirrorPage() {
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Central Interactive Phone Display Area */}
      <div className="flex-1 h-full overflow-hidden relative p-3 md:p-6 flex items-center justify-center">
        <div className="h-full max-h-[88vh] aspect-[9/16] dc-card overflow-hidden shadow-2xl p-1.5 md:p-2.5 relative flex items-center justify-center bg-zinc-950 border-2 border-zinc-700/60 rounded-3xl">
          <PhoneViewport onOpenQuickSettings={() => setIsQuickSettingsOpen(true)} />
        </div>
      </div>

      {/* Desktop Hardware Sidebar Controls */}
      <aside className="hidden lg:block h-full border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <SidebarControls />
      </aside>

      {/* Mobile Quick Settings Bottom Drawer */}
      <QuickSettingsSheet
        isOpen={isQuickSettingsOpen}
        onClose={() => setIsQuickSettingsOpen(false)}
      />
    </div>
  );
}


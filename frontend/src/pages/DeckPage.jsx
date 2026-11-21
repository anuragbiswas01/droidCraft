import React from 'react';
import SidebarControls from '../components/SidebarControls';

export default function DeckPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-xl mx-auto w-full pb-20 md:pb-6">
      <div className="dc-card p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-[var(--text-primary)] tracking-tight">Remote Deck Controls</h3>
        <SidebarControls />
      </div>
    </div>
  );
}


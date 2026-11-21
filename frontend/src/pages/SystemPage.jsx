import React from 'react';
import SystemView from '../components/system/SystemView';

export default function SystemPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
      <SystemView />
    </div>
  );
}


import React from 'react';
import PackagesView from '../components/packages/PackagesView';

export default function AppsPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
      <PackagesView />
    </div>
  );
}


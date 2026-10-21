import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export default function MobileOverlayFab({ onClick }) {
  // Position coordinates for the draggable FAB
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const dragDistRef = useRef(0);

  // Set default initial position bottom-right on mobile
  useEffect(() => {
    setPosition({
      x: window.innerWidth - 68,
      y: window.innerHeight - 110
    });
  }, []);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    dragDistRef.current = 0;
    startPosRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    };
    e.target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startPosRef.current.mouseX;
    const dy = e.clientY - startPosRef.current.mouseY;
    dragDistRef.current += Math.hypot(dx, dy);

    const newX = Math.max(12, Math.min(window.innerWidth - 64, startPosRef.current.posX + dx));
    const newY = Math.max(12, Math.min(window.innerHeight - 64, startPosRef.current.posY + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.target.releasePointerCapture?.(e.pointerId);

    // If moved less than 6px total, treat as a click
    if (dragDistRef.current < 6) {
      onClick?.();
    }
  };

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed z-40 md:hidden w-12 h-12 rounded-full bg-zinc-900/85 dark:bg-zinc-800/90 text-zinc-100 border border-zinc-700/80 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm select-none touch-none hover:bg-zinc-800 transition-colors"
      title="Tap to open Quick Actions (Drag to move)"
      aria-label="Quick Actions Button"
    >
      <SlidersHorizontal className="w-5 h-5 pointer-events-none stroke-[1.75]" />
    </div>
  );
}

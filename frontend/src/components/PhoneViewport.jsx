import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useDevice } from '../context/DeviceContext';
import { Smartphone, AlertTriangle, Monitor, Play } from 'lucide-react';

export default function PhoneViewport({ onOpenQuickSettings }) {
  const { 
    selectedSerial, 
    deviceInfo, 
    screenBlobUrl, 
    sendAction, 
    scrcpySession, 
    launchScrcpy,
    errorBanner,
    setErrorBanner
  } = useDevice();

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [touchIndicator, setTouchIndicator] = useState(null); // { x, y }
  const [swipeIndicator, setSwipeIndicator] = useState(null); // { x1, y1, x2, y2 }
  const [scrollHud, setScrollHud] = useState(null);

  const pointerStartRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const scrollDebounceRef = useRef(null);

  // Compute exact native device coordinates from browser viewport event
  const getDeviceCoords = useCallback((e) => {
    const img = imgRef.current;
    if (!img || !deviceInfo) return null;

    const rect = img.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return null;

    // Check if within image rect
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const nativeW = deviceInfo.screenWidth || 480;
    const nativeH = deviceInfo.screenHeight || 800;

    const scaleX = nativeW / rect.width;
    const scaleY = nativeH / rect.height;

    const deviceX = Math.max(0, Math.min(nativeW, Math.round(clickX * scaleX)));
    const deviceY = Math.max(0, Math.min(nativeH, Math.round(clickY * scaleY)));

    return {
      deviceX,
      deviceY,
      viewportX: clientX - rect.left,
      viewportY: clientY - rect.top
    };
  }, [deviceInfo]);

  // Pointer Down
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // Left click only
    const coords = getDeviceCoords(e);
    if (!coords) return;

    isPointerDownRef.current = true;
    pointerStartRef.current = {
      deviceX: coords.deviceX,
      deviceY: coords.deviceY,
      viewportX: coords.viewportX,
      viewportY: coords.viewportY,
      startTime: Date.now()
    };
  };

  // Pointer Move
  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current || !pointerStartRef.current) return;
    const coords = getDeviceCoords(e);
    if (!coords) return;

    setSwipeIndicator({
      x1: pointerStartRef.current.viewportX,
      y1: pointerStartRef.current.viewportY,
      x2: coords.viewportX,
      y2: coords.viewportY
    });
  };

  // Pointer Up
  const handlePointerUp = async (e) => {
    if (!isPointerDownRef.current || !pointerStartRef.current) return;
    isPointerDownRef.current = false;
    setSwipeIndicator(null);

    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    const coords = getDeviceCoords(e) || { deviceX: start.deviceX, deviceY: start.deviceY };
    const dx = coords.deviceX - start.deviceX;
    const dy = coords.deviceY - start.deviceY;
    const dist = Math.hypot(dx, dy);

    if (dist < 15) {
      // Tap
      setTouchIndicator({ x: start.viewportX, y: start.viewportY });
      setTimeout(() => setTouchIndicator(null), 300);

      try {
        await sendAction({ action: 'tap', x: start.deviceX, y: start.deviceY }, `Tap (${start.deviceX}, ${start.deviceY})`);
      } catch (_) {}
    } else {
      // Swipe
      try {
        await sendAction({
          action: 'swipe',
          x1: start.deviceX,
          y1: start.deviceY,
          x2: coords.deviceX,
          y2: coords.deviceY
        }, `Swipe (${start.deviceX}, ${start.deviceY}) -> (${coords.deviceX}, ${coords.deviceY})`);
      } catch (_) {}
    }
  };

  // Mouse Wheel / Touchpad Scroll
  const handleWheel = (e) => {
    e.preventDefault();
    if (scrollDebounceRef.current) return;

    const isVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
    let direction = 'down';

    if (isVertical) {
      direction = e.deltaY > 0 ? 'down' : 'up';
    } else {
      direction = e.deltaX > 0 ? 'right' : 'left';
    }

    setScrollHud(`Scroll ${direction === 'down' ? '↓' : direction === 'up' ? '↑' : direction === 'left' ? '←' : '→'}`);
    setTimeout(() => setScrollHud(null), 600);

    scrollDebounceRef.current = setTimeout(() => {
      scrollDebounceRef.current = null;
    }, 280);

    sendAction({ action: 'scroll', direction }, `Scroll ${direction}`).catch(() => {});
  };

  const nativeW = deviceInfo?.screenWidth || 480;
  const nativeH = deviceInfo?.screenHeight || 800;
  const aspectRatio = nativeW / nativeH;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-zinc-100/60 dark:bg-zinc-950/80 p-0 md:p-6">
      {/* Error Banner */}
      {errorBanner && (
        <div className="absolute top-3 z-30 flex items-center space-x-2 text-xs bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-md shadow-sm">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="ml-2 font-mono hover:underline">✕</button>
        </div>
      )}

      {/* Scrcpy Status Pill if active */}
      {scrcpySession?.running && (
        <div className="absolute top-3 z-20 flex items-center space-x-2 text-xs bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full shadow-sm">
          <Monitor className="w-3.5 h-3.5 text-emerald-500" />
          <span>scrcpy window active on desktop</span>
        </div>
      )}

      {/* Screen Container: Fullscreen on mobile, framed on desktop */}
      <div 
        ref={containerRef}
        className="relative w-full h-[100dvh] md:h-full max-h-[88vh] md:max-w-md flex items-center justify-center bg-black md:bg-zinc-900 md:rounded-2xl md:border md:border-zinc-800 md:shadow-lg overflow-hidden"
        onWheel={handleWheel}
      >
        {screenBlobUrl ? (
          <div 
            className="relative w-full h-full flex items-center justify-center cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={screenBlobUrl}
              alt="Android Screen"
              draggable="false"
              className="max-w-full max-h-full object-contain pointer-events-none prevent-select"
              style={{ aspectRatio: `${aspectRatio}` }}
            />

            {/* Tap Ripple Indicator */}
            {touchIndicator && (
              <div 
                className="absolute w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/20 pointer-events-none animate-ping transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: touchIndicator.x, top: touchIndicator.y }}
              />
            )}

            {/* Swipe Trajectory Line Indicator */}
            {swipeIndicator && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <line
                  x1={swipeIndicator.x1}
                  y1={swipeIndicator.y1}
                  x2={swipeIndicator.x2}
                  y2={swipeIndicator.y2}
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="4 4"
                />
                <circle cx={swipeIndicator.x2} cy={swipeIndicator.y2} r="5" fill="#38bdf8" />
              </svg>
            )}

            {/* Scroll HUD */}
            {scrollHud && (
              <div className="absolute top-6 px-3 py-1 bg-zinc-900/90 text-zinc-100 text-xs rounded-full border border-zinc-700 pointer-events-none shadow-md">
                {scrollHud}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 p-8 text-center space-y-3">
            <Smartphone className="w-10 h-10 stroke-[1.5]" />
            <div className="text-xs">
              {selectedSerial ? 'Awaiting screen signal...' : 'No device selected'}
            </div>
            {deviceInfo && !deviceInfo.isLegacy && !scrcpySession?.running && (
              <button
                onClick={() => launchScrcpy()}
                className="mt-2 flex items-center space-x-1.5 text-xs bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-700 transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Launch scrcpy</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

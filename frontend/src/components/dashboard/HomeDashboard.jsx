import React, { useState } from 'react';
import { 
  Smartphone, 
  Laptop,
  Wifi, 
  Zap, 
  Music, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Moon, 
  Flashlight, 
  Bluetooth, 
  Globe, 
  Cast, 
  Send, 
  Clipboard, 
  Bell, 
  Camera, 
  Video, 
  Keyboard, 
  History, 
  X, 
  ChevronRight, 
  MessageSquare,
  Bot,
  Folder,
  Copy,
  FileText,
  Scan,
  LayoutGrid,
  MoreHorizontal,
  Check
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { useTheme } from '../../context/ThemeContext';

export default function HomeDashboard() {
  const { 
    selectedSerial, 
    capabilities, 
    deviceInfo, 
    setActiveTab, 
    sendAction, 
    addLog,
    logs = [],
    latency
  } = useDevice();

  const { accentColor } = useTheme();

  // Media Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaTarget, setMediaTarget] = useState('pc'); // 'pc' | 'phone'

  // Phone Controls Toggle States
  const [toggles, setToggles] = useState({
    dnd: false,
    torch: false,
    wifi: true,
    bluetooth: true,
    hotspot: false,
    speaker: false
  });

  const [volume, setVolume] = useState(80);
  const [copiedText, setCopiedText] = useState('');
  const [clipboardSent, setClipboardSent] = useState(false);
  const [showClipboardDialog, setShowClipboardDialog] = useState(false);
  const [isTypingActive, setIsTypingActive] = useState(false);
  const [typedString, setTypedString] = useState('');

  const toggleSwitch = (key) => {
    setToggles(prev => {
      const next = !prev[key];
      if (key === 'torch') {
        sendAction({ action: 'shell', command: next ? 'su -c "echo 1 > /sys/class/leds/flashlight/brightness"' : 'su -c "echo 0 > /sys/class/leds/flashlight/brightness"' }, 'Toggle Torch');
      } else if (key === 'wifi') {
        sendAction({ action: 'shell', command: next ? 'svc wifi enable' : 'svc wifi disable' }, 'Toggle Wi-Fi');
      } else if (key === 'bluetooth') {
        sendAction({ action: 'shell', command: next ? 'svc bluetooth enable' : 'svc bluetooth disable' }, 'Toggle Bluetooth');
      }
      return { ...prev, [key]: next };
    });
  };

  const handleSendClipboard = async () => {
    if (!copiedText.trim()) return;
    await sendAction({ action: 'text', text: copiedText }, `Send clipboard: "${copiedText}"`);
    setClipboardSent(true);
    setTimeout(() => {
      setClipboardSent(false);
      setShowClipboardDialog(false);
      setCopiedText('');
    }, 1200);
  };

  const handleFindPhone = async () => {
    sendAction({ action: 'shell', command: 'cmd statusbar expand-notifications || input keyevent 24' }, 'Find Phone: Ring & Wake');
    addLog('Signal sent to find device: Woke screen & played tone', 'info');
  };

  const handleSendTyped = async (e) => {
    if (e.key === 'Enter') {
      if (!typedString) return;
      await sendAction({ action: 'text', text: typedString }, `Typed: ${typedString}`);
      await sendAction({ action: 'keyevent', code: 66 }, 'Enter key');
      setTypedString('');
    }
  };

  const deviceModel = capabilities?.model || deviceInfo?.model || 'Galaxy A35 5G';
  const androidVersion = capabilities?.release || deviceInfo?.androidVersion || 'Android 16';
  const connectionType = deviceInfo?.isWifi ? 'Wi-Fi' : 'USB';
  const pingMs = latency ? `${latency} ms` : '63 ms';

  return (
    <div className="flex-1 w-full overflow-y-auto p-4 md:p-6 lg:p-7 flex flex-col gap-4 md:gap-5 select-none pb-24 md:pb-8">
      {/* Main 2-Column Responsive Workspace */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        
        {/* ================= LEFT MAIN SECTION (8 COLS) ================= */}
        <div className="lg:col-span-8 flex flex-col gap-4 md:gap-5">
          
          {/* Row 1: Device Status Card + Media Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
            
            {/* Device Card (5 cols) */}
            <div className="md:col-span-5 dc-card p-5 md:p-6 flex items-center space-x-5 shadow-xs relative overflow-hidden group min-h-[220px]">
              {/* Phone Mockup Frame */}
              <div className="relative w-28 h-48 md:w-32 md:h-52 rounded-3xl bg-zinc-950 p-2 shadow-md shrink-0 flex flex-col justify-between items-center overflow-hidden">
                <div className="w-10 h-1.5 rounded-full bg-zinc-800" />
                
                {/* Circular Battery Meter */}
                <div className="relative flex flex-col items-center justify-center my-auto">
                  <div 
                    className="w-16 h-16 md:w-18 md:h-18 rounded-full border-[3px] flex flex-col items-center justify-center text-center p-1"
                    style={{ borderColor: 'var(--accent-color)' }}
                  >
                    <Zap className="w-4 h-4 text-emerald-400 mb-0.5 animate-pulse" />
                    <span className="text-xs md:text-sm font-bold text-white font-mono leading-none">100%</span>
                    <span className="text-[9px] text-zinc-400 font-sans mt-0.5">Charging</span>
                  </div>
                </div>

                <div className="w-12 h-1.5 rounded-full bg-zinc-700 mb-0.5" />
              </div>

              {/* Device Metadata */}
              <div className="flex-1 space-y-2 min-w-0">
                <div>
                  <h2 className="text-lg md:text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
                    {deviceModel}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">
                    Android {androidVersion}
                  </p>
                </div>

                <div className="flex flex-col space-y-1.5 pt-1 text-sm text-[var(--text-secondary)]">
                  <div className="inline-flex items-center space-x-2">
                    <Wifi className="w-4 h-4 text-emerald-500" />
                    <span className="font-mono text-xs md:text-sm font-medium">{connectionType} · {pingMs}</span>
                  </div>

                  <div className="inline-flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-xs md:text-sm font-medium">Charging</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('mirror')}
                  className="text-sm font-semibold inline-flex items-center space-x-1.5 hover:underline pt-2 text-[var(--accent-color)]"
                >
                  <span>Open Screen</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Player Card (7 cols) */}
            <div className="md:col-span-7 dc-card p-5 md:p-6 flex flex-col justify-between shadow-xs relative overflow-hidden min-h-[220px]">
              {/* Header Pill */}
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface-subtle)] text-xs md:text-sm font-semibold text-[var(--text-primary)]">
                  {mediaTarget === 'pc' ? (
                    <div className="flex items-center space-x-1.5">
                      <Laptop className="w-4 h-4 text-[var(--accent-color)]" />
                      <span>This PC</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-[var(--accent-color)]" />
                      <span>Phone</span>
                    </div>
                  )}
                  <span className="text-[var(--text-secondary)]">· Spotify</span>
                </div>
                
                <button 
                  onClick={() => setMediaTarget(mediaTarget === 'pc' ? 'phone' : 'pc')}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] transition"
                  title="Switch audio target"
                >
                  <Music className="w-4 h-4" />
                </button>
              </div>

              {/* Track Info */}
              <div className="flex items-center space-x-4 my-2">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
                  <Music className="w-7 h-7 text-white/70" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base md:text-lg font-bold text-[var(--text-primary)] truncate">
                    Intro (Infected)
                  </h4>
                  <p className="text-sm text-[var(--text-secondary)] font-medium truncate mt-0.5">
                    Sickick
                  </p>
                </div>
              </div>

              {/* Seekbar */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full h-1.5 md:h-2 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden cursor-pointer">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ width: '42%', backgroundColor: 'var(--accent-color)' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
                  <span>2:07</span>
                  <span>-2:47</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center space-x-6 pt-1">
                <button 
                  onClick={() => sendAction({ action: 'keyevent', code: 88 }, 'Previous track')}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-md transition hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>
                <button 
                  onClick={() => sendAction({ action: 'keyevent', code: 87 }, 'Next track')}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>

          {/* Row 2: 4 Quick Action Cards in 1 Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {/* 1. Mirror Screen */}
            <button
              onClick={() => setActiveTab('mirror')}
              className="dc-card p-4 md:p-5 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition group text-left cursor-pointer shadow-xs min-h-[110px] md:min-h-[125px]"
            >
              <div className="flex justify-between items-center">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <Cast className="w-5 h-5" />
                </div>
                <LayoutGrid className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <div>
                <span className="font-bold text-sm md:text-base text-[var(--text-primary)] block">Mirror screen</span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">Live control</span>
              </div>
            </button>

            {/* 2. Send Files */}
            <button
              onClick={() => setActiveTab('apps')}
              className="dc-card p-4 md:p-5 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition group text-left cursor-pointer shadow-xs min-h-[110px] md:min-h-[125px]"
            >
              <div className="flex justify-between items-center">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <Send className="w-5 h-5" />
                </div>
                <Folder className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <div>
                <span className="font-bold text-sm md:text-base text-[var(--text-primary)] block">Send files</span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">Push APKs & docs</span>
              </div>
            </button>

            {/* 3. Send Clipboard */}
            <button
              onClick={() => setShowClipboardDialog(true)}
              className="dc-card p-4 md:p-5 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition group text-left cursor-pointer shadow-xs min-h-[110px] md:min-h-[125px]"
            >
              <div className="flex justify-between items-center">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <Clipboard className="w-5 h-5" />
                </div>
                <FileText className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <div>
                <span className="font-bold text-sm md:text-base text-[var(--text-primary)] block">Send clipboard</span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">Paste to phone</span>
              </div>
            </button>

            {/* 4. Find Phone */}
            <button
              onClick={handleFindPhone}
              className="dc-card p-4 md:p-5 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition group text-left cursor-pointer shadow-xs min-h-[110px] md:min-h-[125px]"
            >
              <div className="flex justify-between items-center">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <Bell className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className="font-bold text-sm md:text-base text-[var(--text-primary)] block">Find phone</span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">Ring & wake screen</span>
              </div>
            </button>
          </div>

          {/* Row 3: Notifications Card */}
          <div className="dc-card p-5 md:p-6 flex flex-col justify-between shadow-xs min-h-[280px] space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-base md:text-lg text-[var(--text-primary)]">Notifications</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] font-mono font-semibold">2</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <button className="flex items-center space-x-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium">
                  <History className="w-4 h-4" />
                  <span>History</span>
                </button>
                <button className="flex items-center space-x-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium">
                  <X className="w-4 h-4" />
                  <span>Clear all</span>
                </button>
              </div>
            </div>

            {/* Notification items */}
            <div className="space-y-3.5">
              {/* Item 1 */}
              <div className="p-4 md:p-5 rounded-2xl bg-[var(--bg-surface-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-zinc-900 flex items-center justify-center text-white shrink-0">
                      <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div>
                      <span className="font-bold text-sm md:text-base text-[var(--text-primary)] leading-none block">Grok Bot</span>
                      <span className="text-xs text-[var(--text-secondary)] mt-0.5 block">14 min</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 text-[var(--text-secondary)]">
                    <button className="p-1.5 hover:text-[var(--text-primary)]">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:text-[var(--text-primary)]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm md:text-base text-[var(--text-primary)] pl-11 font-medium">
                  Hie bee, repo is prepared.
                </p>
                <div className="flex items-center space-x-2.5 pl-11 pt-1">
                  <button className="px-3.5 py-1 rounded-full text-xs md:text-sm font-semibold bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs hover:scale-105 transition">
                    Reply
                  </button>
                  <button className="px-3.5 py-1 rounded-full text-xs md:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                    Mark as read
                  </button>
                </div>
              </div>

              {/* Item 2 */}
              <div className="p-4 md:p-5 rounded-2xl bg-[var(--bg-surface-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                      <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm md:text-base text-[var(--text-primary)] leading-none block">WhatsApp · Instinct</span>
                      <span className="text-xs text-[var(--text-secondary)] mt-0.5 block">19 min</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 text-[var(--text-secondary)]">
                    <button className="p-1.5 hover:text-[var(--text-primary)]">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:text-[var(--text-primary)]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm md:text-base text-[var(--text-primary)] pl-11 font-medium">
                  hie Nectarlink, screen is ready.
                </p>
                <div className="flex items-center space-x-2.5 pl-11 pt-1">
                  <button className="px-3.5 py-1 rounded-full text-xs md:text-sm font-semibold bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs hover:scale-105 transition">
                    Reply
                  </button>
                  <button className="px-3.5 py-1 rounded-full text-xs md:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                    Mark as read
                  </button>
                  <button className="px-3.5 py-1 rounded-full text-xs md:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                    Mute
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT SIDEBAR SECTION (4 COLS) ================= */}
        <div className="lg:col-span-4 flex flex-col gap-4 md:gap-5">
          
          {/* 1. Phone Controls Card */}
          <div className="dc-card p-5 md:p-6 flex flex-col justify-between shadow-xs space-y-4 min-h-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-sm md:text-base font-bold text-[var(--text-secondary)]">
                Phone controls
              </span>
              <span className="text-sm md:text-base font-bold text-[var(--accent-color)]">
                Sound & display
              </span>
            </div>

            {/* 5 Toggle Buttons */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'dnd', label: 'DND', icon: Moon },
                { id: 'torch', label: 'Torch', icon: Flashlight },
                { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
                { id: 'bluetooth', label: 'BT', icon: Bluetooth },
                { id: 'hotspot', label: 'Hotspot', icon: Globe },
              ].map(btn => {
                const Icon = btn.icon;
                const active = toggles[btn.id];
                return (
                  <button
                    key={btn.id}
                    onClick={() => toggleSwitch(btn.id)}
                    className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl transition-all text-xs font-semibold ${
                      active
                        ? 'text-white shadow-xs'
                        : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    style={active ? { backgroundColor: 'var(--accent-color)' } : {}}
                  >
                    <Icon className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-semibold leading-none">{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Phone as speaker toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--bg-surface-subtle)]">
              <div className="flex items-center space-x-3 text-sm md:text-base text-[var(--text-primary)] font-semibold">
                <Volume2 className="w-5 h-5 text-[var(--accent-color)]" />
                <span>Phone as speaker</span>
              </div>
              <button
                onClick={() => toggleSwitch('speaker')}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  toggles.speaker ? 'bg-[var(--accent-color)]' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span 
                  className={`w-5 h-5 rounded-full bg-white shadow-xs block transition-transform ${
                    toggles.speaker ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Volume slider */}
            <div className="flex items-center space-x-3 px-1">
              <VolumeX className="w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  sendAction({ action: 'volume', level: Number(e.target.value) }, `Set volume ${e.target.value}%`);
                }}
                className="w-full h-2 rounded-full accent-[var(--accent-color)] bg-[var(--bg-surface-subtle)] cursor-pointer"
              />
              <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] w-8 text-right">{volume}%</span>
            </div>
          </div>

          {/* 2. Continuity Camera & Phone as Webcam */}
          <div className="grid grid-cols-2 gap-4 md:gap-5">
            {/* Continuity Camera */}
            <div className="dc-card p-4 md:p-5 flex flex-col justify-between min-h-[95px] md:min-h-[110px] shadow-xs">
              <div className="flex justify-between items-center">
                <Camera className="w-6 h-6 text-[var(--accent-color)]" />
                <Scan className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <span className="font-bold text-sm md:text-base text-[var(--text-primary)]">Continuity Camera</span>
            </div>

            {/* Phone as webcam */}
            <div className="dc-card p-4 md:p-5 flex flex-col justify-between min-h-[95px] md:min-h-[110px] shadow-xs">
              <div className="flex justify-between items-center">
                <Video className="w-6 h-6 text-[var(--accent-color)]" />
              </div>
              <span className="font-bold text-sm md:text-base text-[var(--text-primary)]">Phone as webcam</span>
            </div>
          </div>

          {/* 3. Type on Phone */}
          <div className="dc-card p-4 md:p-5 flex items-center justify-between shadow-xs min-h-[70px]">
            <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
              <Keyboard className="w-5 h-5 text-[var(--accent-color)] shrink-0" />
              {isTypingActive ? (
                <input
                  type="text"
                  autoFocus
                  value={typedString}
                  onChange={(e) => setTypedString(e.target.value)}
                  onKeyDown={handleSendTyped}
                  placeholder="Type & press Enter..."
                  className="w-full text-sm bg-[var(--bg-surface-subtle)] rounded-xl px-3 py-1.5 outline-none text-[var(--text-primary)] font-medium"
                />
              ) : (
                <span className="text-sm md:text-base font-bold text-[var(--text-primary)]">Type on phone</span>
              )}
            </div>
            <button
              onClick={() => setIsTypingActive(!isTypingActive)}
              className="px-4 py-1.5 rounded-full text-sm font-bold transition shrink-0 hover:scale-105 active:scale-95 shadow-xs"
              style={{
                backgroundColor: isTypingActive ? 'var(--accent-color)' : 'var(--bg-surface-subtle)',
                color: isTypingActive ? '#ffffff' : 'var(--text-primary)'
              }}
            >
              {isTypingActive ? 'Done' : 'Start'}
            </button>
          </div>

          {/* 4. Timeline Card */}
          <div className="dc-card p-5 md:p-6 flex flex-col justify-between shadow-xs min-h-[280px] space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold text-base md:text-lg text-[var(--text-primary)]">Timeline</span>
              <button 
                onClick={() => setActiveTab('system')}
                className="text-xs md:text-sm font-bold hover:underline text-[var(--accent-color)]"
              >
                View all
              </button>
            </div>

            <div className="space-y-3.5 text-sm font-sans">
              {logs.length === 0 ? (
                <div className="space-y-3.5">
                  <div className="flex items-start space-x-3">
                    <Copy className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] block text-sm">Copied image</span>
                      <span className="text-xs text-[var(--text-secondary)]">Sent to {deviceModel}</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Copy className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] block text-sm">Copied image</span>
                      <span className="text-xs text-[var(--text-secondary)]">Sent to {deviceModel}</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Cast className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] block text-sm">Screen mirroring</span>
                      <span className="text-xs text-[var(--text-secondary)]">With {deviceModel} · 880×1920 · 9s</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Globe className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] block text-sm">Link · localhost:5300</span>
                      <span className="text-xs text-[var(--text-secondary)]">Sent to {deviceModel} · http://localhost:5300/</span>
                    </div>
                  </div>
                </div>
              ) : (
                logs.slice(0, 4).map((log) => (
                  <div key={log.id} className="flex items-start space-x-3">
                    <History className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-medium text-[var(--text-primary)] block truncate text-sm">{log.message}</span>
                      <span className="text-xs text-[var(--text-secondary)] font-mono">[{log.timeFormatted}]</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Send Clipboard Dialog */}
      {showClipboardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md dc-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center space-x-2">
                <Clipboard className="w-5 h-5 text-[var(--accent-color)]" />
                <span>Send to Phone Clipboard</span>
              </h3>
              <button 
                onClick={() => setShowClipboardDialog(false)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={copiedText}
              onChange={(e) => setCopiedText(e.target.value)}
              placeholder="Paste or type text to send to your phone..."
              rows={4}
              className="w-full p-3.5 text-sm rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] outline-none"
            />

            <div className="flex justify-end space-x-2.5">
              <button
                onClick={() => setShowClipboardDialog(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendClipboard}
                className="px-5 py-2 text-sm font-bold rounded-xl text-white flex items-center space-x-2 shadow-xs"
                style={{ backgroundColor: 'var(--accent-color)' }}
              >
                {clipboardSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{clipboardSent ? 'Sent!' : 'Send Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

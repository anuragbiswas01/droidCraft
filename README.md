# mobiCraft — Minimalist Android Screen Mirror & Controller

A fast, responsive, web-based Android controller supporting both **legacy devices** (Android 4.2.2 Jelly Bean, API 17) via optimized ADB screencap and **modern devices** (Android 5.0+, API 21+) via hardware-accelerated **scrcpy**.

---

## 📱 Features

- **Dual-Engine Architecture**:
  - **Legacy Engine (Android 4.2.2+)**: Reliable `/data/local/tmp` file staging + `adb pull` with mutex locking, coordinate-accurate touch mapping, 4-argument swipe, and status bar control.
  - **Modern Engine (Android 5.0+)**: Seamless integration with **scrcpy** for high-framerate desktop mirroring.
- **Modern Minimalist UI**:
  - Built with **React**, **Tailwind CSS**, and **Lucide React**.
  - Clean, distraction-free interface with flat borders and **zero noisy gradients**.
  - **Dark & Light Mode** support with 1-click toggle and persistence.
- **Responsive-First Mobile Support**:
  - Fullscreen phone mirror on mobile viewports (`100dvh`).
  - **Draggable Floating Overlay Button (FAB)**: move it anywhere across your screen; tapping it opens the Quick Controls sheet.
- **Local Network (LAN / Wi-Fi) Sharing**:
  - Listen on `0.0.0.0:3000` to access mobiCraft from other phones, tablets, or computers on your local Wi-Fi.
  - 1-click **Copy LAN URL** badge in the header.
- **Persistent Local Database**:
  - Lightweight file-based JSON storage (`backend/data/db.json`) for device settings, preferred engine modes, custom tool paths, and recent activity logs.

---

## 🏗️ Project Architecture

```text
mobiCraft/
├── backend/
│   ├── services/
│   │   ├── adb.js          # Raw ADB legacy capture & touch engine
│   │   ├── scrcpy.js       # Scrcpy process & session manager
│   │   └── db.js           # Lightweight local JSON database
│   ├── routes/
│   │   ├── devices.js      # Device discovery & compatibility checks
│   │   ├── screen.js       # Screen frame capture stream
│   │   ├── actions.js      # Keyevents, touch, swipe, scroll, text injection
│   │   ├── scrcpy.js       # Scrcpy session start & stop
│   │   └── settings.js     # System settings, LAN discovery, activity logs
│   ├── server.js           # Modular Express server (0.0.0.0:3000)
│   └── data/               # Persistent DB storage
├── frontend/               # React + Tailwind + Lucide + Vite
│   ├── src/
│   │   ├── context/
│   │   │   ├── ThemeContext.jsx    # Light / Dark theme toggle
│   │   │   └── DeviceContext.jsx   # Real-time device state & stream
│   │   ├── components/
│   │   │   ├── Header.jsx          # Device selector, mode tag, LAN share
│   │   │   ├── PhoneViewport.jsx   # Responsive mirror (fullscreen on mobile)
│   │   │   ├── MobileOverlayFab.jsx# Draggable floating action button
│   │   │   ├── QuickSettingsSheet.jsx # Mobile quick drawer
│   │   │   ├── SidebarControls.jsx # Desktop controls & activity log
│   │   │   └── SettingsModal.jsx   # Tool paths & network info
│   │   ├── services/api.js         # Centralized API client
│   │   └── App.jsx
│   └── dist/                       # Pre-compiled production bundle
├── package.json
└── server.js                       # Root forwarder to backend/server.js
```

---

## 🚀 Quick Start Guide

### 1. Verify ADB & Scrcpy

Open PowerShell and verify:

```powershell
adb devices
scrcpy --version
```

### 2. Start mobiCraft

```powershell
npm start
```

Startup banner:

```text
===================================================
 mobiCraft Backend Service (Express + Local DB)
 -------------------------------------------------
 > Local:   http://localhost:3000
 > Network: http://192.168.29.73:3000 (Wi-Fi)
===================================================
```

### 3. Open in Browser

- **On PC:** Open `http://localhost:3000`
- **On another phone / tablet:** Open `http://192.168.29.73:3000`

---

## 🛠️ Development Scripts

| Command                | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `npm start`            | Starts Express server serving pre-built React frontend on port 3000 |
| `npm run build`        | Builds the React frontend into `frontend/dist`                      |
| `npm run dev:frontend` | Starts Vite development server with hot-module reload on port 5173  |
| `npm run dev:backend`  | Starts backend with `--watch` reload on port 3000                   |

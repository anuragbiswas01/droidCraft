# DroidCraft

<div align="center">

```text
 ____             _     _  ____            __ _   
|  _ \ _ __ ___  (_) __| |/ ___|_ __ __ _ / _| |_ 
| | | | '__/ _ \ | |/ _` | |   | '__/ _` | |_| __|
| |_| | | | (_) || | (_| | |___| | | (_| |  _| |_ 
|____/|_|  \___/_/ |\__,_|\____|_|  \__,_|_|  \__|
               |__/                                
```

**Minimalist, universal web-based Android screen mirror & controller**  
*Dual-engine support for vintage legacy devices (Android 4.2.2 Jelly Bean) and modern hardware (Android 5.0+ to 14+) via scrcpy.*

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Android Compatibility](https://img.shields.io/badge/Android-4.2.2_to_14%2B-3DDC84?style=flat-square&logo=android&logoColor=white)](https://developer.android.com)
[![scrcpy Support](https://img.shields.io/badge/scrcpy-v2.0%2B-orange?style=flat-square&logo=scrcpy&logoColor=white)](https://github.com/Genymobile/scrcpy)

</div>

---

## 📌 Overview

**DroidCraft** is a lightweight, responsive, and cross-platform web application that lets you mirror and fully control Android devices directly from your web browser. 

Whether you are recovering data from an old smartphone with a broken digitizer, repurposing a vintage phone as a smart dashboard, or managing a modern phone wirelessly across your local network, DroidCraft automatically adapts to the connected hardware.

### 💡 Why DroidCraft?

* **Vintage Android Phones (4.2.2 Jelly Bean, API 17):** Modern tools like `scrcpy` fail on legacy Android because APIs like `MediaProjection` and hardware video encoders simply do not exist. DroidCraft features an optimized low-level ADB capture pipeline utilizing mutex-locked `/data/local/tmp` frame staging and raw coordinate translation.
* **Modern Android Phones (5.0+ to 14+):** For modern devices, DroidCraft integrates directly with **scrcpy** to deliver hardware-accelerated mirroring at up to 60 FPS with ultra-low latency.
* **Local Network (LAN / Wi-Fi) Sharing:** Host DroidCraft on your PC and control the connected phone from any iPad, tablet, or another smartphone on your home or office Wi-Fi network.

---

## ✨ Key Features

- **⚡ Dual-Engine Mirroring Architecture**:
  - **Legacy Engine (Android 4.2.2 - 4.4)**: Atomic `/data/local/tmp` capture staging + `adb pull` with in-flight mutex concurrency locking, coordinate-accurate touch mapping, multi-argument swipe duration handling, and system status bar toggling.
  - **Modern Engine (Android 5.0+)**: One-click launch and session management for **scrcpy** with customizable bitrates, resolutions, and screen keep-awake flags.
- **🖱️ Full Interactive Input**:
  - **Click to Tap**: Native coordinate scaling ensures pixel-accurate taps regardless of viewport size.
  - **Drag to Swipe**: Natural click-and-drag gestures with velocity calculations.
  - **Scroll Wheel**: Smooth mouse wheel scrolling mapped to calibrated vertical ADB swipe gestures.
  - **Keyboard Navigation**: Physical key event injections for `Back`, `Home`, `Recents (App Switch)`, `Power`, and `Volume Up / Down`.
- **📱 Responsive Mobile-First Controller UI**:
  - Fullscreen phone mirror view on mobile devices (`100dvh`).
  - **Draggable Floating Action Button (FAB)**: Reposition the control handle anywhere on screen; tap to open the quick actions drawer.
  - **Quick Controls Bottom Sheet**: Easy one-thumb access to device controls when operating from a smartphone.
- **🌐 Seamless Local Network (LAN) Sharing**:
  - Express server listens on `0.0.0.0:3000` for seamless local network access.
  - Header displays detected Wi-Fi IP with a **1-click Copy LAN URL** badge.
- **🎨 Minimalist, Clean Aesthetics**:
  - Built with React 19, Tailwind CSS, and Lucide icons.
  - Clean borders, high-contrast typography (Inter & JetBrains Mono), and distraction-free styling without noisy gradients.
  - **Dark / Light Theme** with instantaneous toggle and `localStorage` persistence.
- **🗄️ File-Based Local JSON Storage**:
  - Automatically persists device profiles, preferred engine modes, custom executable paths, and timestamped action audit logs in `backend/data/db.json`.

---

## 🏛️ Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │               Client Browser                 │
                    │      (Desktop PC / Tablet / Smartphone)      │
                    └──────────────────────┬───────────────────────┘
                                           │ HTTP / REST API
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │               DroidCraft Server              │
                    │            (Node.js + Express 4)             │
                    │             Listening on 0.0.0.0             │
                    └───────┬──────────────────────────────┬───────┘
                            │                              │
         Legacy Engine      │                              │     Modern Engine
         (Android 4.2.2+)   ▼                              ▼     (Android 5.0+)
                 ┌───────────────────────┐      ┌─────────────────────────┐
                 │       ADB CLI         │      │      scrcpy Engine      │
                 │  - screencap staging  │      │  - Hardware video stream│
                 │  - raw coordinate tap │      │  - Desktop mirror window│
                 │  - input keyevent     │      │  - Low latency 60 FPS   │
                 └──────────┬────────────┘      └────────────┬────────────┘
                            │                                │
                            └───────────────┬────────────────┘
                                            ▼
                             ┌─────────────────────────────┐
                             │    Connected Android Phone  │
                             │        (USB / Wi-Fi)        │
                             └─────────────────────────────┘
```

### 📁 Project Structure

```text
droidcraft/
├── backend/
│   ├── data/
│   │   ├── .gitkeep
│   │   └── db.json             # Persistent device configs & action history
│   ├── routes/
│   │   ├── actions.js          # Touch, swipe, scroll & keyevent endpoints
│   │   ├── devices.js          # Device discovery & compatibility checks
│   │   ├── screen.js           # Atomic screencap frame buffer stream
│   │   ├── scrcpy.js           # Scrcpy process lifecycle & session manager
│   │   └── settings.js         # Tool paths, LAN discovery, activity logs
│   ├── services/
│   │   ├── adb.js              # Raw ADB legacy capture & touch engine
│   │   ├── db.js               # Lightweight JSON storage service
│   │   └── scrcpy.js           # Scrcpy execution manager
│   └── server.js               # Express application (0.0.0.0:3000)
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx           # Device selector, mode indicator, LAN copy
│   │   │   ├── MobileOverlayFab.jsx # Draggable floating touch button
│   │   │   ├── PhoneViewport.jsx    # Real-time mirror & gesture capture
│   │   │   ├── QuickSettingsSheet.jsx # Mobile slide-up control drawer
│   │   │   ├── SettingsModal.jsx    # Tool paths & network configuration
│   │   │   └── SidebarControls.jsx  # Desktop toolbar & live action logs
│   │   ├── context/
│   │   │   ├── DeviceContext.jsx    # Active device state & screen refresh loop
│   │   │   └── ThemeContext.jsx     # Dark & light mode state
│   │   ├── services/
│   │   │   └── api.js               # Typed fetch API client
│   │   ├── App.jsx                  # Main responsive layout container
│   │   ├── index.css                # Tailwind CSS imports & theme styling
│   │   └── main.jsx
│   ├── index.html                   # HTML entrypoint
│   ├── package.json
│   └── vite.config.js
├── package.json                     # Root orchestrator scripts
├── server.js                        # Forwarder entrypoint to backend/server.js
└── README.md
```

---

## 📋 Prerequisites

Before running DroidCraft, make sure you have the following installed on your host machine (Windows, macOS, or Linux):

1. **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
2. **Android Platform Tools (ADB)**:
   - Ensure `adb` is installed and added to your system `PATH`.
   - Verify in your terminal:
     ```bash
     adb version
     ```
3. **scrcpy** *(Optional, recommended for Android 5.0+)*:
   - Windows: `winget install Genymobile.scrcpy` or [Download from GitHub](https://github.com/Genymobile/scrcpy/releases)
   - macOS: `brew install scrcpy`
   - Linux: `sudo apt install scrcpy`
   - *Note: If scrcpy is installed in a custom directory, you can configure the exact executable path directly in the DroidCraft Settings UI.*

---

## 🚀 Quick Start Guide

### 1. Enable USB Debugging on Your Android Phone

1. Open **Settings** on your Android device.
2. Navigate to **About Phone** and tap **Build Number** 7 times to enable **Developer Options**.
3. Open **Developer Options** and turn on **USB Debugging**.
4. Connect the device to your PC via a USB data cable.
5. If prompted on the phone screen, select **"Always allow from this computer"** and tap **OK**.

Verify the phone is recognized:

```bash
adb devices
```
*Expected output:*
```text
List of devices attached
0123456789ABCDEF    device
```

---

### 2. Install Dependencies

Clone this repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/your-username/droidcraft.git
cd droidcraft

# Install root dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install
```

---

### 3. Build & Launch

You can run DroidCraft in production mode or development mode:

#### Production Mode (Recommended)

```bash
# Build the React frontend
npm run build

# Start the unified DroidCraft server
npm start
```

Upon launching, the console outputs your local and network URLs:

```text
===================================================
 DroidCraft Backend Service (Express + Local DB)
 -------------------------------------------------
 > Local:   http://localhost:3000
 > Network: http://192.168.1.105:3000 (Wi-Fi)
===================================================
```

#### Development Mode (With Hot Reloading)

To work on both frontend and backend concurrently:

```bash
# Terminal 1: Backend service (Node with --watch)
npm run dev:backend

# Terminal 2: Frontend Vite dev server (port 5173 with proxy)
npm run dev:frontend
```

---

### 4. Open in Your Browser

- **On your PC**: Open [http://localhost:3000](http://localhost:3000)
- **On another phone, tablet, or laptop on the same Wi-Fi**: Open the displayed network URL (e.g. `http://192.168.1.105:3000`).

---

## 🎮 Controls & Gestures

| Action | Desktop (Mouse / Keyboard) | Mobile / Tablet (Touchscreen) | Underlying ADB / System Event |
| :--- | :--- | :--- | :--- |
| **Tap** | Left Click on screen | Single tap on screen | `adb shell input tap <X> <Y>` |
| **Swipe / Drag** | Click and drag across mirror | Drag finger across mirror | `adb shell input swipe <X1> <Y1> <X2> <Y2> <ms>` |
| **Scroll** | Mouse scroll wheel up / down | Two-finger drag or swipe | Calibrated vertical swipe |
| **Back Button** | Click **Back** or Right-click mirror | Tap **Back** in quick drawer | `adb shell input keyevent 4` |
| **Home Button** | Click **Home** | Tap **Home** in quick drawer | `adb shell input keyevent 3` |
| **Recents (App Switch)** | Click **Recents** | Tap **Recents** in quick drawer | `adb shell input keyevent 187` |
| **Power Button Toggle** | Click **Power** (with confirmation) | Tap **Power** in quick drawer | `adb shell input keyevent 26` |
| **Volume Up / Down** | Click **Vol +** / **Vol -** | Tap **Vol +** / **Vol -** | `adb shell input keyevent 24` / `25` |
| **Notification Shade** | Click **Notifications** | Tap **Notifications** in quick drawer | `adb shell cmd statusbar expand-notifications` |
| **Wake Device** | Click **Wake** | Tap **Wake** in quick drawer | `adb shell input keyevent 224` |
| **Text Injection** | Type into text field & press Enter | Enter text in Quick Settings | `adb shell input text '<escaped_string>'` |

---

## ⚙️ Configuration & Custom Tool Paths

Click the **Gear icon** in the top navigation bar to access the **Settings Modal**:

* **ADB Executable Path**: Set to `adb` (default) or provide an absolute path (e.g., `C:\platform-tools\adb.exe` or `/usr/bin/adb`).
* **scrcpy Executable Path**: Set to `scrcpy` (default) or provide an absolute path (e.g., `C:\Tools\scrcpy\scrcpy.exe`).
* **Mirror Settings**: Configure default max resolution (`1024`, `720`, `1920`), video bitrates (`2M`, `4M`, `8M`), and stay-awake flags.
* **Local Network URLs**: View all active IPv4 interfaces with instant 1-click clipboard copy.

Settings are saved automatically to `backend/data/db.json` and persist across server restarts.

---

## 📡 REST API Reference

DroidCraft exposes a clean, modular REST API:

### Device Management

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/devices` | Lists all connected ADB devices with model, Android version, API level, and recommended engine. |
| `POST` | `/api/devices/select` | Sets the currently active device serial. |

### Screen Mirroring

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/screen/frame?serial=<serial>` | Retrieves an atomic PNG screenshot of the device screen. |

### Input Actions

| Method | Endpoint | Payload | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/actions/tap` | `{ serial, x, y }` | Simulates a touch tap at specified coordinates. |
| `POST` | `/api/actions/swipe` | `{ serial, x1, y1, x2, y2, duration }` | Simulates a swipe gesture. |
| `POST` | `/api/actions/scroll` | `{ serial, direction }` | Simulates vertical scroll up or down. |
| `POST` | `/api/actions/keyevent` | `{ serial, keycode }` | Injects an Android keyevent code (e.g., 3 for Home, 4 for Back). |
| `POST` | `/api/actions/text` | `{ serial, text }` | Injects text input into the currently focused field. |

### scrcpy Engine

| Method | Endpoint | Payload | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/scrcpy/start` | `{ serial, maxSize, bitrate, stayAwake }` | Launches hardware-accelerated scrcpy mirror session. |
| `POST` | `/api/scrcpy/stop` | `{ serial }` | Terminates active scrcpy process. |
| `GET` | `/api/scrcpy/status?serial=<serial>` | — | Checks if scrcpy is currently active for the device. |

### System & Settings

| Method | Endpoint | Payload | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/settings` | — | Returns current configuration, detected tools, and LAN URLs. |
| `POST` | `/api/settings` | `{ adbPath, scrcpyPath, ... }` | Updates and persists configuration settings. |
| `GET` | `/api/settings/logs` | — | Returns the list of recent action logs. |
| `POST` | `/api/settings/logs/clear` | — | Clears the action log history. |

---

## 🔍 Troubleshooting & FAQs

### 1. `adb: device unauthorized`
- **Cause:** Your phone has not authorized the PC's RSA key.
- **Fix:** Disconnect and reconnect the USB cable, unlock your phone, and look for the **"Allow USB debugging?"** prompt. Tap **"Always allow"** and confirm.

### 2. `screencap: error: closed` or zero-byte captures on old phones
- **Cause:** Android 4.2.2 lacks support for modern `exec-out` pipes and has restricted write permissions to `/sdcard`.
- **Fix:** DroidCraft automatically handles this by staging captures in `/data/local/tmp`, pulling them over ADB, and immediately cleaning up the temporary files.

### 3. `scrcpy: command not found`
- **Cause:** scrcpy is not installed or not present in your system `PATH`.
- **Fix:** Either install scrcpy via your package manager or open the DroidCraft **Settings** modal and enter the full path to your `scrcpy.exe` binary. Note: scrcpy is optional; devices running Android 4.2.2 will always use the built-in Legacy ADB engine.

### 4. Cannot connect from another phone / tablet over Wi-Fi
- **Cause:** Windows Defender Firewall or local network router isolation is blocking incoming connections to port 3000.
- **Fix:** In Windows Defender Firewall, allow incoming TCP connections for Node.js on port 3000 for Private Networks. Ensure both devices are connected to the same Wi-Fi network.

### 5. Port 3000 already in use
- **Fix:** Set a custom port before starting:
  ```bash
  PORT=3001 npm start
  ```

---

## 🛠️ Built With

* **Backend**: [Node.js](https://nodejs.org/), [Express 4](https://expressjs.com/)
* **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Device Bridge**: [Android Debug Bridge (ADB)](https://developer.android.com/tools/adb), [Genymobile scrcpy](https://github.com/Genymobile/scrcpy)

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

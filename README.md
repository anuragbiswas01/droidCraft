# mobiCraft — Android 4.2.2 Browser-Based Screen Controller

A lightweight, local web application designed to mirror and control legacy Android devices (specifically Android 4.2.2 Jelly Bean, API 17) with broken physical screens over USB ADB on Windows.

---

## 📱 Features

- **Reliable Legacy Capture**: Uses `/data/local/tmp` file staging and `adb pull` to overcome Android 4.2.2 `/sdcard` corruption and the absence of modern `adb exec-out` / MediaProjection APIs.
- **Local Browser Mirror**: Streams live frames to a modern, responsive browser interface running at `http://127.0.0.1:3000`.
- **Coordinate-Accurate Touch Control**: Accurate click-to-tap and drag-to-swipe translation that compensates for viewport letterboxing (`object-fit: contain`) down to the exact native device pixel.
- **Hardware & Soft Keys**: One-click shortcuts for Wake (`224`), Power (`26`, with toggle warning modal), Home (`3`), Back (`4`), Menu (`82`), Volume Up/Down (`24`/`25`), and Enter (`66`).
- **Remote Text Entry**: Send text strings with automatic space escaping (`%s`) and safe character handling suited for legacy Android shell input.
- **Concurrency & Overlap Protection**: Mutex-locking per device prevents overlapping screenshot calls from choking ADB over USB.
- **Zero Host & Device Bloat**: Automatically purges temporary PNG files on both the Android device and Windows host immediately after ingestion.
- **Safe Local Architecture**: Binds strictly to `127.0.0.1` and executes ADB commands via `child_process.execFile` with separate parameter arrays to prevent shell command injection.

---

## 🛠️ Prerequisites

1. **Windows PC** (PowerShell or Command Prompt).
2. **Node.js (LTS version 18+ or 20+)** installed on Windows.
3. **Android Platform Tools (`adb.exe`)** installed and added to your Windows system `PATH` (or configured via the in-app settings modal).
4. **Target Phone**: Android 4.2.2 device connected via USB cable with **USB Debugging already enabled and authorized**.
   > **Note:** Because the target device's physical screen is broken, USB debugging must have been authorized previously on this PC. A web application cannot blindly authorize an unauthorized ADB key without on-screen confirmation.

---

## 🚀 Quick Start Guide

### 1. Verify ADB Connection
Open PowerShell and verify that your phone is recognized:
```powershell
adb devices
```
Expected output:
```text
List of devices attached
0123456789ABCDEF    device
```
*(Ensure the state says `device`, **not** `unauthorized` or `offline`)*.

### 2. Install Project Dependencies
In the project directory (`c:\Workspace\2. anuragbiswas01\mobiCraft`):
```powershell
npm install
```

### 3. Start the Local Server
```powershell
npm start
```
You will see:
```text
===================================================
 mobiCraft - Android 4.2.2 Screen Controller
 -------------------------------------------------
 > Local:   http://localhost:3000
 > Network: http://192.168.29.73:3000  (Wi-Fi)
===================================================
```

### 4. Open in Your Browser
- **On this PC:** Open `http://localhost:3000` or `http://127.0.0.1:3000`
- **From another phone / tablet / laptop on your Wi-Fi:** Open the Network URL (e.g., `http://192.168.29.73:3000`)
- **Quick Share:** Click the **LAN** button in the mobiCraft header to copy the Wi-Fi link directly to your clipboard.

The controller will automatically detect your phone (`0123456789ABCDEF`), display its native resolution (e.g. `480 x 800`), pull the current screen, and start live polling.

---

## 🎮 How to Use the Controller

| Action | How to Perform | Details |
|---|---|---|
| **Tap / Click** | Click anywhere on the phone display | Emits `adb shell input tap X Y`. A blue ripple indicator highlights your click. |
| **Swipe / Drag** | Click and drag across the screen | Emits `adb shell input swipe X1 Y1 X2 Y2`. A glowing trail shows the swipe path. |
| **Mouse Wheel Scroll** | Scroll mouse wheel / touchpad over display | Automatically translates wheel delta to smooth up/down or left/right swipe gestures. |
| **Directional Pad** | Click **▲ Swipe Up**, **▼ Swipe Down**, **◀ Swipe Left**, **▶ Swipe Right** | One-click full-screen directional swipes. |
| **Quick Scroll** | Click **Scroll Down**, **Scroll Up**, **Page Down**, **Page Up** | Natural scrolling and Android Page navigation (`keyevents 92/93`). |
| **Keyboard Navigation** | Press Arrow Keys or Page Up/Down on page | Seamless keyboard-based scroll and swipe control. |
| **Home Button** | Click **Home** or the bottom capacitive circle | Emits Keyevent 3. |
| **Back Button** | Click **Back** or the bottom capacitive arrow | Emits Keyevent 4. |
| **Menu Button** | Click **Menu** or the bottom capacitive lines | Emits Keyevent 82. |
| **Wake Display** | Click **Wake Up** | Emits Keyevent 224 to turn on screen backlight. |
| **Power Button** | Click **Power Key** | Prompts a confirmation dialog before sending Keyevent 26 to prevent accidental screen shutoff. |
| **Text Entry** | Type into the "Remote Text Input" box and press Send | Emits `adb shell input text <encodedText>` (spaces converted to `%s`). |
| **Refresh Stream** | Click **Refresh** or toggle **Live / Paused** | Change refresh frequency (500ms, 1000ms, 2000ms, 5000ms) or pause stream to save CPU/USB load. |

---

## 🏗️ Architecture & Project Structure

```text
mobiCraft/
├── package.json        # Dependencies (Express) and startup scripts
├── server.js           # Secure Express HTTP backend (127.0.0.1:3000)
├── adb.js              # Safe ADB child_process execution, locking & PNG parser
├── public/
│   ├── index.html      # Glassmorphic UI layout with phone mockup & controls
│   ├── styles.css      # Dark mode styling, micro-animations & layout
│   └── app.js          # Coordinate mapping, polling loop & event handlers
└── README.md           # Documentation and setup guide
```

### Key Technical Details

1. **Why `/data/local/tmp` instead of `/sdcard`?**
   On Android 4.2.2 devices, `/sdcard` writes often fail or result in 0-byte files due to emulated storage mount permissions or corrupted FAT partitions. `/data/local/tmp` is the official, high-speed writable directory for the `shell` user.
2. **Why not `adb exec-out screencap -p`?**
   `exec-out` was introduced in Android 5.0 (API 21). On Android 4.2.2 (API 17), `adb exec-out` returns `error: closed`. Staging the PNG into `/data/local/tmp` and pulling it via `adb pull` is the most reliable method for legacy devices.
3. **Letterbox-Aware Coordinate Calculation**:
   The CSS uses `object-fit: contain` inside a responsive phone mockup. The frontend JavaScript calculates the exact render rectangle within the container, discards clicks in the black letterbox margins, and scales viewport offsets directly to the device's native dimensions (`480 x 800`).
4. **Concurrency Guard**:
   Screenshot capture takes ~1.2s to 1.4s over USB. If the refresh timer triggers while a capture is already in-flight, the frontend and backend drop the overlapping request rather than queuing duplicate commands.

---

## 🔧 REST API Endpoints

All endpoints are bound strictly to `127.0.0.1`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Lists connected devices, authorization state, and active ADB path. |
| `POST` | `/api/adb-path` | Updates custom `adb.exe` path (`{ "adbPath": "C:\\path\\adb.exe" }`). |
| `GET` | `/api/device-info?serial=...` | Retrieves device model, brand, Android version, and resolution. |
| `GET` | `/api/screen.png?serial=...` | Captures and returns PNG stream with custom headers (`X-Screen-Width`, `X-Screen-Height`, `X-Capture-Duration-Ms`). Returns HTTP 429 if capture is already in-flight. |
| `GET` | `/api/last-screen.png?serial=...` | Serves the cached last valid screenshot without triggering a new capture. |
| `POST` | `/api/action` | Dispatches sanitized input actions (`tap`, `swipe`, `home`, `back`, `menu`, `wake`, `power`, `volume_up`, `volume_down`, `enter`, `backspace`, `text`). |

---

## 🔍 Troubleshooting

### 1. Device shows `unauthorized` or does not appear in `adb devices`
- **Cause:** The USB debugging authorization dialog was not accepted or revoked.
- **Solution:** Reconnect the USB cable. Because the phone's physical screen is broken, you cannot press "Allow" on the phone. You must connect the phone to a PC that has previously been authorized, or restore your known `adbkey` / `adbkey.pub` into `%USERPROFILE%\.android\`.

### 2. `ADB not found` or command errors
- **Cause:** `adb.exe` is not in your Windows system PATH.
- **Solution:** Click the ⚙️ (Settings) icon in the top right of the controller UI, enter the absolute path to your `adb.exe` (e.g., `C:\Users\anura\AppData\Local\Android\Sdk\platform-tools\adb.exe`), and click **Save & Apply**.

### 3. Screen preview is completely black
- **Cause:** The phone display went to sleep, or the Power toggle turned the screen off.
- **Solution:** Click the **Wake Up** button (or click **Power Key** once). Android 4.2.2 screencap captures the framebuffer; if the display is asleep, it returns a black image.

### 4. Taps seem offset or unresponsive
- **Cause:** Clicks made in the black letterbox borders outside the phone's screen aspect ratio are intentionally ignored.
- **Solution:** Click directly within the active screen image inside the phone bezel. Verify that the resolution metric in the bottom bar displays `480 x 800`.

### 5. USB bandwidth or high CPU usage
- **Solution:** Use the interval selector in the top bar to change refresh rate from `Balanced (1000ms)` to `Slow (2000ms)` or `Saver (5000ms)`, or click the `Live/Pause` button to freeze refreshing when viewing a static page.

---

## 📄 License
MIT License. Created for local debugging and recovery of legacy Android hardware.

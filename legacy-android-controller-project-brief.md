# Android 4.2.2 Browser-Based ADB Screen Controller — Project Brief

## 1. Project goal

Build a small, local web application that lets a user view and control an old Android phone from a Windows PC, as a basic alternative to scrcpy.

The target phone runs **Android 4.2.2 (API 17)** and its physical screen is not working. ADB works over USB. The solution must use old-Android-compatible ADB commands rather than relying on modern Android APIs or scrcpy.

The browser is the user interface, but **a browser alone cannot access USB ADB or execute shell commands**. The project therefore needs a local backend service on Windows that invokes `adb`, with the browser communicating with that service over localhost.

## 2. Known working setup

- Host OS: Windows; user runs PowerShell.
- Windows user directory: `C:\Users\anura`.
- Phone Android version: `4.2.2`.
- ADB device serial currently shown: `0123456789ABCDEF`.
- `adb devices` reports the device as `device`.
- This command works to create a test file:
  ```powershell
  adb shell "echo hello > /data/local/tmp/check.txt"
  ```
- `/sdcard` writes have produced zero-byte files on this phone. Avoid `/sdcard` for screenshot/temp files.
- **Screenshot capture works when saved to `/data/local/tmp`:**
  ```powershell
  adb shell screencap -p /data/local/tmp/test.png
  adb shell ls -l /data/local/tmp/test.png
  adb pull /data/local/tmp/test.png "$HOME\Desktop\test.png"
  ```
  The pulled image was successfully captured using this path.
- `adb exec-out screencap -p` returned `error: closed` in the current environment; do not rely on it.
- Input commands work:
  ```powershell
  adb shell input keyevent 26
  adb shell input keyevent 3
  ```
  The user reports that this combination worked to wake/toggle the screen and return Home.
- Useful commands to implement:
  ```powershell
  adb shell input keyevent 224   # wakeup event; device support can vary
  adb shell input keyevent 26    # power-button toggle; can turn screen off if already on
  adb shell input keyevent 3     # Home
  adb shell input keyevent 4     # Back
  adb shell input keyevent 82    # Menu
  adb shell input tap X Y
  adb shell input swipe X1 Y1 X2 Y2 DURATION_MS
  adb shell screencap -p /data/local/tmp/<unique-name>.png
  adb pull /data/local/tmp/<unique-name>.png <local-file>
  ```
- Device dimensions have not yet been confirmed. Query with a suitable ADB command, or infer from screenshot dimensions.

## 3. Preferred architecture

Use a simple local stack:
- **Backend:** Node.js + Express (or another minimal Node HTTP server).
- **Frontend:** HTML, CSS, and vanilla JavaScript; optionally use a small framework only if it materially simplifies the UI.
- **ADB:** invoke the installed `adb.exe` using Node's `child_process.spawn`/`execFile`, never by concatenating untrusted user input into a shell command.
- **Transport:** browser calls the backend through HTTP on `127.0.0.1`, e.g. `http://127.0.0.1:PORT`.
- **Scope:** local single-user development tool; no cloud service, remote internet exposure, or account system required.

Do not attempt to use browser WebUSB as a substitute for ADB in the initial version. Do not expose an unauthenticated server to the LAN or public internet.

## 4. Required MVP features

1. **Device connection status**
   - Run `adb devices` and show connected device(s).
   - Let the user select a serial if more than one device is connected.
   - Show a clear error if no authorized device is found.
   - Allow configuring the path to `adb.exe` if it is not on PATH.

2. **Screen preview**
   - Capture using `adb shell screencap -p /data/local/tmp/<unique-name>.png`.
   - Pull the file to a temporary directory on the Windows host.
   - Serve the resulting PNG through a backend endpoint.
   - Refresh on a configurable interval, default approximately 1000 ms. Avoid overlapping captures; if a capture is still running, skip the next refresh.
   - Use unique filenames or safe cleanup to prevent stale-image confusion.
   - Show capture errors and retain the last valid screenshot if a refresh fails.
   - Clean up remote temporary images after successful pulls when feasible.
   - Avoid `/sdcard` because it yielded zero-byte files on the target device.

3. **Mouse interaction**
   - Clicking the preview sends `adb shell input tap X Y`.
   - Convert browser coordinates to actual device-screen coordinates based on the displayed image's natural dimensions and its displayed bounding rectangle. Account for `object-fit: contain` letterboxing so clicks map accurately.
   - Dragging on the preview sends `adb shell input swipe X1 Y1 X2 Y2 DURATION_MS`.
   - Prevent accidental click after a drag.
   - Clamp coordinates to the valid screen bounds.
   - Keep pointer handling usable on desktop browsers.

4. **Controls**
   - Buttons for:
     - Wake (`KEYCODE_WAKEUP`, keyevent `224`; may vary by device)
     - Power button (`keyevent 26`; label clearly warns it toggles and can turn screen off)
     - Home (`keyevent 3`)
     - Back (`keyevent 4`)
     - Menu (`keyevent 82`)
     - Refresh screenshot now
   - Optionally add text entry using `adb shell input text ...`, but properly escape/sanitize it and explain that spaces/special characters may be tricky on old Android.
   - Show command status / success or error messages.

5. **Safety and usability**
   - Bind the server to `127.0.0.1` only by default.
   - Validate HTTP methods, request bodies, serial numbers, coordinates, durations, and all command parameters.
   - Use `spawn` or `execFile` with argument arrays, not `exec` with a user-built shell string.
   - Restrict input commands to a fixed allowlist; do not provide an arbitrary shell-command endpoint.
   - Add reasonable request limits and timeouts.
   - Explain that ADB USB debugging must already be enabled and authorized.
   - Do not attempt to bypass PINs, passwords, or other device security.
   - Make the UI usable without seeing or touching the phone itself.

## 5. Suggested API endpoints

These are design suggestions; implementation may adjust them while preserving the behavior.

- `GET /api/status`
  - Returns connection status and detected devices/serials.
- `GET /api/screen.png?serial=...`
  - Captures a fresh screenshot and responds with `image/png`, or returns a clear error.
  - If using this endpoint for polling, prevent concurrent capture operations.
- `POST /api/action`
  - JSON body with a fixed action such as:
    ```json
    { "serial": "0123456789ABCDEF", "action": "home" }
    ```
  - For tap:
    ```json
    { "serial": "0123456789ABCDEF", "action": "tap", "x": 200, "y": 400 }
    ```
  - For swipe:
    ```json
    {
      "serial": "0123456789ABCDEF",
      "action": "swipe",
      "x1": 300,
      "y1": 800,
      "x2": 300,
      "y2": 200,
      "durationMs": 300
    }
    ```
- `GET /api/device-info?serial=...`
  - Returns screen dimensions and Android version if detectable.

Use a consistent JSON error shape, such as `{ "error": "Readable message" }`, and appropriate HTTP status codes. Avoid exposing arbitrary filesystem paths or command output that may contain sensitive data.

## 6. Implementation details and pitfalls

- Prefer `child_process.spawn` or `execFile` with separate arguments:
  - `adb -s SERIAL devices` is not valid syntax for `devices` in all versions; generally run `adb devices` to enumerate, then use `adb -s SERIAL shell ...` for device-specific commands.
  - Use `adb -s SERIAL shell screencap -p /data/local/tmp/name.png`.
  - Use `adb -s SERIAL pull /data/local/tmp/name.png LOCAL_TEMP_PATH`.
- ADB versions differ. Test the exact argument behavior on the developer's installed platform-tools.
- On the target phone, `/sdcard` output was zero bytes even for `echo` redirection, while `/data/local/tmp` works. Keep all screenshot staging in `/data/local/tmp`.
- The Android screenshot must be nonempty and should be validated on the backend before returning it.
- For capture, use a unique safe filename (e.g. timestamp/counter generated by backend, not user input).
- Do not run concurrent screenshot captures for the same device.
- Avoid blocking the Node event loop; await child processes asynchronously.
- For mouse mapping, use the image's natural pixel dimensions. If the preview is scaled, map the visible image rectangle to its native coordinates rather than the outer container.
- `input keyevent 26` toggles the power button and may turn the display off. Provide a warning/confirmation in the UI.
- Android 4.2.2 may have device-specific limitations. Keep implementation simple and display actionable errors.
- The physical screen being broken does not inherently prevent Android screenshot capture; capture has already succeeded through `/data/local/tmp`.

## 7. Suggested UI

A single responsive page:
- Header: “Legacy Android Controller”
- Connection badge/status and device selector
- Large screen preview with `object-fit: contain`
- Controls: Wake, Power, Home, Back, Menu, Refresh
- Small status line showing capture age, image dimensions, and action errors
- Refresh interval selector (e.g. 500 ms, 1000 ms, 2000 ms)
- Optional “Pause refresh” button to reduce CPU/USB activity

Do not use a full-screen image that distorts the phone's aspect ratio. Make the preview clickable and draggable, with correct coordinate mapping.

## 8. Project structure suggestion

```text
legacy-android-controller/
  package.json
  server.js
  adb.js
  public/
    index.html
    styles.css
    app.js
  README.md
```

## 9. Setup and run instructions expected

The finished project should include a README that explains:

1. Install a current supported Node.js LTS version on Windows.
2. Ensure Android Platform Tools / `adb.exe` are installed and available.
3. Connect the phone over USB and run `adb devices`.
4. Confirm the device appears as `device`, not `unauthorized`.
5. Install dependencies with `npm install`.
6. Start the server with `npm start`.
7. Open the local URL shown in the terminal (e.g. `http://127.0.0.1:3000`).
8. Troubleshooting:
   - no device / unauthorized
   - ADB not found
   - screenshot capture fails or returns zero bytes
   - screen preview is black
   - taps are offset due to scaling
   - power key toggled screen off
9. Mention that the phone's USB debugging must already be enabled and authorized; the app cannot enable it blindly on a dead-screen device.

## 10. Acceptance criteria

The MVP is complete when:

- It detects the connected Android 4.2.2 device.
- It displays a screenshot captured through `/data/local/tmp` and pulled to Windows.
- The preview refreshes without overlapping capture requests.
- Clicking the preview produces the correct ADB tap coordinates.
- Dragging produces a swipe.
- Home, Back, Menu, Wake, Power, and manual refresh buttons work.
- It clearly reports errors and never silently displays a zero-byte or stale screenshot as fresh.
- It runs locally on Windows and does not expose ADB control to the network.
- The README provides reproducible setup and troubleshooting steps.

## 11. Development priorities

Build in this order:
1. Verify Node can run ADB and list the phone.
2. Implement screenshot capture/pull and return PNG bytes from the backend.
3. Build the browser preview and manual refresh.
4. Add automatic polling with overlap prevention.
5. Add Home/Back/Wake/Power/Menu actions.
6. Add coordinate-correct taps and swipes.
7. Add error handling, input validation, and README.

Start with a reliable basic MVP, not a perfect low-latency mirror. Refresh-based screenshots are expected to be slower and less smooth than scrcpy.

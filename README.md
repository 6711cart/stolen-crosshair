# Stolen Crosshair

A Windows crosshair overlay and desktop studio. It includes a click-through, always-on-top crosshair; 11 featured shapes with 50 customizable variations; and a live editor for color, outline, size, gap, opacity, position, rotation, spin, rainbow, glow, and pulse effects.

## Open the app

1. Install Node.js 20 or newer.
2. Open this folder in PowerShell.
3. Run `npm.cmd install`.
4. Run `npm.cmd run build`.
5. Run `npm.cmd start` to open the app, or launch the installer/portable executable from `release`.

The crosshair appears in the center of each display by default. It remains on top without intercepting mouse clicks. Close the studio window to leave the crosshair running in the system tray.

## Downloadable Windows builds

Run `npm.cmd run build` to create the Windows installer and portable `.exe` in `release`. The installer offers Start Menu and desktop shortcuts. Run `npm.cmd run build:portable` to build only the portable app.

## Using the studio

- Start in **Crosshair Library** to select a featured geometry. Choose **All variations · 50** to browse the full library; use the heart buttons to keep favorites.
- **Dashboard**, **Customize**, and **Motion & Effects** provide live previews and immediately update the on-screen overlay.
- **Image Upload** accepts transparent PNG, JPG, WEBP, and GIF files up to 5 MB.
- Save, rename, load, duplicate, and delete named designs in **Saved Crosshairs**. Export or import a JSON config to move settings between devices.
- All settings and saved designs persist locally. The default overlay shortcut is **Ctrl+Alt+X**; it can be changed under **Advanced Settings**.

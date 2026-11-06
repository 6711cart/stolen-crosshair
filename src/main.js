const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_NAME = 'Stolen Crosshair';
const DEFAULT_SETTINGS = {
  presetId: 'cross-01',
  color: '#ffffff',
  outlineColor: '#05070a',
  rainbow: false,
  rainbowSpeed: 1,
  spinSpeed: 100,
  spinning: false,
  spinDirection: 1,
  rotation: 0,
  size: 17,
  thickness: 1,
  gap: 1,
  opacity: 100,
  outline: 1,
  centerDot: false,
  positionX: 0,
  positionY: 0,
  scale: 100,
  glowIntensity: 0,
  shadowStrength: 8,
  pulse: false,
  imageData: '',
  imageName: '',
  overlayEnabled: true,
  allDisplays: true,
  hotkey: 'CommandOrControl+Alt+X',
  startAtLogin: false
};
const gotSingleInstanceLock = app.requestSingleInstanceLock();
let dashboard;
let tray;
let settings = { ...DEFAULT_SETTINGS };
let savedDesigns = [];
let currentHotkey = null;
const overlays = new Map();
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings = { ...DEFAULT_SETTINGS, ...(saved.settings || saved) };
    savedDesigns = Array.isArray(saved.savedDesigns) ? saved.savedDesigns : [];
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
      console.error('Could not read settings:', error);
    }
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ settings, savedDesigns }, null, 2), 'utf8');
  } catch (error) {
    console.error('Could not save settings:', error);
  }
}

function broadcastSettings() {
  for (const window of overlays.values()) {
    if (!window.isDestroyed()) window.webContents.send('crosshair:settings', settings);
  }
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.webContents.send('crosshair:settings', settings);
  }
}

function createOverlay(display) {
  const overlay = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.webContents.once('did-finish-load', () => {
    overlay.webContents.send('crosshair:settings', settings);
    if (settings.overlayEnabled && (settings.allDisplays || display.id === screen.getPrimaryDisplay().id)) {
      overlay.showInactive();
    }
  });
  overlay.on('closed', () => overlays.delete(display.id));
  overlays.set(display.id, overlay);
}

function syncOverlays() {
  const displays = screen.getAllDisplays();
  const activeIds = new Set(displays.map((display) => display.id));
  for (const [id, overlay] of overlays) {
    if (!activeIds.has(id)) {
      overlay.close();
      overlays.delete(id);
    }
  }
  for (const display of displays) {
    let overlay = overlays.get(display.id);
    if (!overlay || overlay.isDestroyed()) {
      createOverlay(display);
      continue;
    }
    overlay.setBounds(display.bounds);
    if (settings.overlayEnabled && (settings.allDisplays || display.id === screen.getPrimaryDisplay().id)) {
      if (!overlay.isVisible()) overlay.showInactive();
    } else {
      overlay.hide();
    }
  }
}

function setOverlayEnabled(enabled) {
  settings.overlayEnabled = Boolean(enabled);
  saveSettings();
  syncOverlays();
  broadcastSettings();
  if (tray) tray.setContextMenu(createTrayMenu());
}

function registerHotkey(shortcut) {
  if (currentHotkey) globalShortcut.unregister(currentHotkey);
  currentHotkey = shortcut || DEFAULT_SETTINGS.hotkey;
  if (!globalShortcut.register(currentHotkey, () => setOverlayEnabled(!settings.overlayEnabled))) {
    console.warn(`Could not register ${currentHotkey}. It may already be in use.`);
  }
}

function createTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Stolen Crosshair', click: showDashboard },
    {
      label: settings.overlayEnabled ? 'Hide crosshair' : 'Show crosshair',
      click: () => setOverlayEnabled(!settings.overlayEnabled)
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
}

function createTray() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="#55b9e8" stroke-width="2"/><path d="M16 1v9M16 22v9M1 16h9M22 16h9" stroke="#55b9e8" stroke-width="2"/><circle cx="16" cy="16" r="2" fill="#55b9e8"/></svg>';
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`));
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(createTrayMenu());
  tray.on('double-click', showDashboard);
}

function createDashboard() {
  dashboard = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 1050,
    minHeight: 710,
    title: APP_NAME,
    backgroundColor: '#0a121d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  dashboard.loadFile(path.join(__dirname, 'index.html'));
  dashboard.webContents.once('did-finish-load', () => {
    dashboard.webContents.send('crosshair:settings', settings);
    dashboard.webContents.send('crosshair:saved-designs', savedDesigns);
  });
  dashboard.on('closed', () => { dashboard = null; });
}

function showDashboard() {
  if (!dashboard || dashboard.isDestroyed()) {
    createDashboard();
  } else {
    dashboard.show();
    dashboard.focus();
  }
}

if (gotSingleInstanceLock) {
  app.on('second-instance', showDashboard);
  app.whenReady().then(() => {
    app.setAppUserModelId('com.stolencrosshair.app');
    readSettings();
    app.setLoginItemSettings({ openAtLogin: settings.startAtLogin });
    syncOverlays();
    createDashboard();
    createTray();
    screen.on('display-added', syncOverlays);
    screen.on('display-removed', syncOverlays);
    screen.on('display-metrics-changed', syncOverlays);
    registerHotkey(settings.hotkey);
  });

  app.on('activate', showDashboard);
  app.on('before-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', (event) => event.preventDefault());

  ipcMain.handle('crosshair:get-settings', () => settings);
  ipcMain.handle('crosshair:save-settings', (_event, nextSettings) => {
    if (!nextSettings || typeof nextSettings !== 'object') {
      throw new TypeError('Settings must be an object.');
    }
    settings = { ...settings, ...nextSettings };
    saveSettings();
    if (settings.hotkey !== currentHotkey) registerHotkey(settings.hotkey);
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.startAtLogin) });
    syncOverlays();
    broadcastSettings();
    if (tray) tray.setContextMenu(createTrayMenu());
    return settings;
  });
  ipcMain.handle('crosshair:toggle-overlay', () => {
    setOverlayEnabled(!settings.overlayEnabled);
    return settings.overlayEnabled;
  });
  ipcMain.handle('crosshair:get-saved-designs', () => savedDesigns);
  ipcMain.handle('crosshair:save-designs', (_event, nextDesigns) => {
    if (!Array.isArray(nextDesigns)) throw new TypeError('Saved designs must be an array.');
    savedDesigns = nextDesigns;
    saveSettings();
    if (dashboard && !dashboard.isDestroyed()) dashboard.webContents.send('crosshair:saved-designs', savedDesigns);
    return savedDesigns;
  });
  ipcMain.handle('crosshair:save-config', (_event, config) => {
    if (!config || typeof config !== 'object' || !config.settings) {
      throw new TypeError('The configuration file is invalid.');
    }
    settings = { ...DEFAULT_SETTINGS, ...config.settings };
    if (Array.isArray(config.savedDesigns)) savedDesigns = config.savedDesigns;
    if (settings.hotkey !== currentHotkey) registerHotkey(settings.hotkey);
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.startAtLogin) });
    saveSettings();
    syncOverlays();
    broadcastSettings();
    return { settings, savedDesigns };
  });
}

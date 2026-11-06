const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crosshairApp', {
  getSettings: () => ipcRenderer.invoke('crosshair:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('crosshair:save-settings', settings),
  toggleOverlay: () => ipcRenderer.invoke('crosshair:toggle-overlay'),
  getSavedDesigns: () => ipcRenderer.invoke('crosshair:get-saved-designs'),
  saveDesigns: (designs) => ipcRenderer.invoke('crosshair:save-designs', designs),
  saveConfig: (config) => ipcRenderer.invoke('crosshair:save-config', config),
  onSettings: (callback) => {
    ipcRenderer.on('crosshair:settings', (_event, settings) => callback(settings));
  },
  onSavedDesigns: (callback) => {
    ipcRenderer.on('crosshair:saved-designs', (_event, designs) => callback(designs));
  }
});

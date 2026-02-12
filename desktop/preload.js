/**
 * Nexus Chat Desktop — Preload Script
 * Exposes safe APIs to the renderer process via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  retry: () => ipcRenderer.send('retry-connection'),
  getServerURL: () => ipcRenderer.invoke('get-server-url'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, message, type) => callback(message, type));
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key, value) => ipcRenderer.send('update-setting', key, value),
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setBadge: (count) => ipcRenderer.send('set-badge', count),
  platform: process.platform,
  isElectron: true
});
/**
 * Nexus Chat Desktop — Preload Script
 * Exposes safe APIs to the renderer process via contextBridge.
 * Includes auto-update status channels.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Connection
  retry: () => ipcRenderer.send('retry-connection'),
  getServerURL: () => ipcRenderer.invoke('get-server-url'),
  
  // Splash status updates (from main process)
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, message, type) => callback(message, type));
  },

  // Auto-updater status (from updater module)
  onUpdaterStatus: (callback) => {
    ipcRenderer.on('updater-status', (event, payload) => callback(payload));
  },

  // Manual update controls
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.send('updater:install'),
  getUpdateStatus: () => ipcRenderer.invoke('updater:status'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key, value) => ipcRenderer.send('update-setting', key, value),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  setBadge: (count) => ipcRenderer.send('set-badge', count),

  // Platform info
  platform: process.platform,
  isElectron: true
});
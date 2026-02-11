const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusOverlay', {
  // Overlay controls
  toggleOverlay: () => ipcRenderer.send('toggle-overlay'),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  setOverlayInteractive: (interactive) => ipcRenderer.send('overlay-interactive', interactive),

  // Listen for events from main process
  onOverlayToggle: (callback) => ipcRenderer.on('overlay-toggled', (_, state) => callback(state)),
  onOverlayMessage: (callback) => ipcRenderer.on('overlay-message', (_, msg) => callback(msg)),

  // Send messages between windows
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  sendMessage: (msg) => ipcRenderer.send('overlay-send-message', msg),
  requestMessages: () => ipcRenderer.send('request-messages'),
  onMessagesUpdate: (callback) => ipcRenderer.on('messages-update', (_, msgs) => callback(msgs)),
  onNewMessage: (callback) => ipcRenderer.on('new-message', (_, msg) => callback(msg)),

  // Overlay state
  getOverlayState: () => ipcRenderer.invoke('get-overlay-state'),
});
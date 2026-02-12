/**
 * Nexus Chat Desktop — Main Process
 * Electron wrapper that connects to the Railway-hosted Nexus Chat server.
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, shell,
        globalShortcut, ipcMain, screen, dialog, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
const config = require('./config');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let serverURL = config.RAILWAY_URL;

const store = new Store({
  defaults: {
    windowBounds: { width: config.WINDOW.WIDTH, height: config.WINDOW.HEIGHT },
    windowPosition: null,
    windowMaximized: false,
    minimizeToTray: config.APP.MINIMIZE_TO_TRAY,
    autoLaunch: config.APP.AUTO_LAUNCH,
    startMinimized: config.APP.START_MINIMIZED,
    lastServerURL: config.RAILWAY_URL,
    notifications: true
  }
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============ SPLASH SCREEN ============
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420, height: 480,
    frame: false, transparent: false, resizable: false, skipTaskbar: true,
    backgroundColor: config.WINDOW.BACKGROUND_COLOR,
    icon: config.PATHS.ICON,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: config.PATHS.PRELOAD
    }
  });
  splashWindow.loadFile(config.PATHS.SPLASH);
  splashWindow.center();
  splashWindow.setAlwaysOnTop(true);
}

function updateSplashStatus(message, type = '') {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', message, type);
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ============ MAIN WINDOW ============
function createMainWindow() {
  const bounds = store.get('windowBounds');
  const position = store.get('windowPosition');
  const wasMaximized = store.get('windowMaximized');

  const opts = {
    width: bounds.width, height: bounds.height,
    minWidth: config.WINDOW.MIN_WIDTH, minHeight: config.WINDOW.MIN_HEIGHT,
    title: config.WINDOW.TITLE,
    backgroundColor: config.WINDOW.BACKGROUND_COLOR,
    show: false, autoHideMenuBar: true,
    icon: config.PATHS.ICON,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: config.PATHS.PRELOAD,
      spellcheck: true, sandbox: false,
      webSecurity: true, allowRunningInsecureContent: false
    }
  };

  if (position) {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some(d => {
      const { x, y, width, height } = d.bounds;
      return position.x >= x && position.x < x + width && position.y >= y && position.y < y + height;
    });
    if (onScreen) { opts.x = position.x; opts.y = position.y; }
  }

  mainWindow = new BrowserWindow(opts);
  if (wasMaximized) mainWindow.maximize();

  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
    saveWindowState();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const origin = new URL(serverURL).origin;
    if (!url.startsWith(origin) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return mainWindow;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isMax = mainWindow.isMaximized();
  store.set('windowMaximized', isMax);
  if (!isMax) {
    const b = mainWindow.getBounds();
    store.set('windowBounds', { width: b.width, height: b.height });
    store.set('windowPosition', { x: b.x, y: b.y });
  }
}

// ============ SERVER CONNECTION ============
async function checkServerHealth(url) {
  const { net } = require('electron');
  return new Promise((resolve) => {
    let responded = false;
    const req = net.request({ method: 'GET', url: `${url}/api/health` });
    req.on('response', (res) => { if (!responded) { responded = true; resolve(res.statusCode >= 200 && res.statusCode < 400); } });
    req.on('error', () => { if (!responded) { responded = true; resolve(false); } });
    setTimeout(() => { if (!responded) { responded = true; req.abort(); resolve(false); } }, 10000);
    req.end();
  });
}

async function connectToServer() {
  const urls = [serverURL, ...config.FALLBACK_URLS.filter(u => u !== serverURL)];
  for (let attempt = 1; attempt <= config.APP.MAX_RETRIES; attempt++) {
    for (const url of urls) {
      updateSplashStatus(`Connecting to server... (attempt ${attempt}/${config.APP.MAX_RETRIES})`);
      if (await checkServerHealth(url)) {
        serverURL = url;
        store.set('lastServerURL', url);
        updateSplashStatus('Connected! Loading app...', 'success');
        return url;
      }
    }
    if (attempt < config.APP.MAX_RETRIES) {
      updateSplashStatus(`Server unavailable. Retrying in ${config.APP.RETRY_DELAY / 1000}s...`, 'error');
      await new Promise(r => setTimeout(r, config.APP.RETRY_DELAY));
    }
  }
  updateSplashStatus('Could not connect to server', 'error');
  return null;
}

async function loadApp() {
  if (config.APP.SHOW_SPLASH) createSplashWindow();
  const connectedURL = await connectToServer();
  createMainWindow();

  if (connectedURL) {
    mainWindow.loadURL(connectedURL);
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        closeSplash();
        if (!store.get('startMinimized')) { mainWindow.show(); mainWindow.focus(); }
      }, 500);
    });
    mainWindow.webContents.on('did-fail-load', (ev, code, desc) => {
      console.error(`Failed to load: ${desc} (${code})`);
      mainWindow.loadFile(config.PATHS.SPLASH);
      mainWindow.show();
      closeSplash();
    });
  } else {
    mainWindow.loadFile(config.PATHS.SPLASH);
    mainWindow.show();
    closeSplash();
  }
}

// ============ SYSTEM TRAY ============
function createTray() {
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(config.PATHS.ICON).resize({ width: 16, height: 16 });
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Nexus Chat');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Nexus Chat', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Minimize to Tray', type: 'checkbox', checked: store.get('minimizeToTray'), click: (item) => store.set('minimizeToTray', item.checked) },
    { label: 'Notifications', type: 'checkbox', checked: store.get('notifications'), click: (item) => store.set('notifications', item.checked) },
    { type: 'separator' },
    { label: 'Server Status', click: async () => {
      const ok = await checkServerHealth(serverURL);
      dialog.showMessageBox({ type: ok ? 'info' : 'warning', title: 'Server Status', message: ok ? '✅ Server is online' : '❌ Server is offline', detail: `Connected to: ${serverURL}` });
    }},
    { label: 'Open in Browser', click: () => shell.openExternal(serverURL) },
    { type: 'separator' },
    { label: 'Quit Nexus Chat', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

// ============ IPC HANDLERS ============
function setupIPC() {
  ipcMain.on('retry-connection', async () => {
    const url = await connectToServer();
    if (url && mainWindow) mainWindow.loadURL(url);
  });
  ipcMain.handle('get-server-url', () => serverURL);
  ipcMain.handle('get-settings', () => ({
    minimizeToTray: store.get('minimizeToTray'),
    autoLaunch: store.get('autoLaunch'),
    startMinimized: store.get('startMinimized'),
    notifications: store.get('notifications'),
    serverURL
  }));
  ipcMain.on('update-setting', (ev, key, value) => {
    store.set(key, value);
    if (key === 'autoLaunch') app.setLoginItemSettings({ openAtLogin: value, openAsHidden: store.get('startMinimized') });
  });
  ipcMain.on('show-notification', (ev, title, body) => {
    if (store.get('notifications') && Notification.isSupported()) {
      const n = new Notification({ title: title || 'Nexus Chat', body: body || '', icon: config.PATHS.ICON });
      n.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
      n.show();
    }
  });
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('set-badge', (ev, count) => {
    if (process.platform === 'darwin') app.dock.setBadge(count > 0 ? String(count) : '');
    if (process.platform === 'win32' && count > 0 && mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true);
  });
}

// ============ APP LIFECYCLE ============
app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('com.nexuschat.desktop');
  setupIPC();
  createTray();
  await loadApp();
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (mainWindow) {
      mainWindow.isVisible() && mainWindow.isFocused() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
    }
  });
});

app.on('before-quit', () => { isQuitting = true; saveWindowState(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow) mainWindow.show(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (tray) { tray.destroy(); tray = null; } });
const { app, BrowserWindow, Menu, Tray, nativeImage, shell, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
let overlayWindow;
let tray = null;
let isQuitting = false;
let overlayVisible = false;

// ============ MAIN WINDOW ============

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    title: 'Nexus Chat',
    backgroundColor: '#0b0e14',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ============ OVERLAY WINDOW ============

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  overlayWindow.loadFile('overlay.html');

  // Make it click-through when not interactive
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Keep overlay on top of fullscreen games
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Prevent the overlay from appearing in the taskbar
  overlayWindow.setSkipTaskbar(true);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  // Show overlay window (invisible until toggled)
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.showInactive();
  });
}

function toggleOverlay() {
  if (!overlayWindow) {
    createOverlayWindow();
    return;
  }

  overlayVisible = !overlayVisible;

  if (overlayVisible) {
    // Make overlay interactive (clickable)
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.focus();
    overlayWindow.webContents.send('overlay-toggled', true);
  } else {
    // Make overlay click-through again
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.webContents.send('overlay-toggled', false);
  }
}

// ============ IPC HANDLERS ============

function setupIPC() {
  // Toggle overlay from renderer
  ipcMain.on('toggle-overlay', () => {
    toggleOverlay();
  });

  // Close overlay
  ipcMain.on('close-overlay', () => {
    if (overlayWindow) {
      overlayVisible = false;
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      overlayWindow.webContents.send('overlay-toggled', false);
    }
  });

  // Set overlay interactive state
  ipcMain.on('overlay-interactive', (_, interactive) => {
    if (overlayWindow) {
      if (interactive) {
        overlayWindow.setIgnoreMouseEvents(false);
      } else {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  });

  // Forward messages from overlay to main window
  ipcMain.on('overlay-send-message', (_, msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new-message', msg);
    }
  });

  // Request messages from main window
  ipcMain.on('request-messages', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('request-messages');
    }
  });

  // Forward messages from main to overlay
  ipcMain.on('messages-update', (_, msgs) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('messages-update', msgs);
    }
  });

  // Get overlay state
  ipcMain.handle('get-overlay-state', () => {
    return { visible: overlayVisible };
  });
}

// ============ GLOBAL SHORTCUTS ============

function registerShortcuts() {
  // Shift + ` (backtick) to toggle overlay — similar to Steam's Shift+Tab
  globalShortcut.register('Shift+`', () => {
    toggleOverlay();
  });

  // Alternative: Shift+Tab (like Steam)
  // Note: This may conflict with other apps, so we use Shift+` as primary
  // Uncomment below to also register Shift+Tab:
  // globalShortcut.register('Shift+Tab', () => {
  //   toggleOverlay();
  // });

  // Ctrl+Shift+N to show/hide main window
  globalShortcut.register('Ctrl+Shift+N', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ============ TRAY ============

function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'icon.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createFallbackIcon();
    }
  } catch (e) {
    trayIcon = createFallbackIcon();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Nexus Chat',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Toggle Game Overlay',
      click: () => {
        toggleOverlay();
      }
    },
    { type: 'separator' },
    {
      label: 'Overlay Hotkey: Shift + `',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Nexus Chat — Shift+` for overlay');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createFallbackIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 14;
    canvas[i * 4 + 1] = 165;
    canvas[i * 4 + 2] = 233;
    canvas[i * 4 + 3] = 255;
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ============ APPLICATION MENU ============

function createMenu() {
  const template = [
    {
      label: 'Nexus Chat',
      submenu: [
        { label: 'About Nexus Chat', role: 'about' },
        { type: 'separator' },
        {
          label: 'Toggle Game Overlay',
          accelerator: 'Shift+`',
          click: () => toggleOverlay()
        },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('openSettings()');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { isQuitting = true; app.quit(); }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ============ SINGLE INSTANCE ============

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupIPC();
    createWindow();
    createOverlayWindow();
    createTray();
    createMenu();
    registerShortcuts();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});
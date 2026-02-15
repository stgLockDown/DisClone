/**
 * Nexus Chat Desktop — Auto-Updater Module
 * Uses electron-updater with GitHub Releases as the update source.
 * 
 * Flow:
 *   1. On app launch, check GitHub Releases for a newer version
 *   2. If found, download in background (show progress on splash)
 *   3. Once downloaded, install and restart automatically
 *   4. User never has to manually download — one launcher forever
 */
const { autoUpdater } = require('electron-updater');
const { app, dialog, ipcMain } = require('electron');
const path = require('path');

let splashSender = null;   // BrowserWindow.webContents for splash screen updates
let mainSender = null;     // BrowserWindow.webContents for main window updates
let updateDownloaded = false;
let updateAvailable = false;
let downloadProgress = 0;
let updateInfo = null;
let isCheckingForUpdate = false;

// ============ CONFIGURATION ============
function configure() {
  // Log to console for debugging
  autoUpdater.logger = require('electron').app.isPackaged ? null : console;

  // Don't auto-download — we control when to download
  autoUpdater.autoDownload = false;

  // Don't auto-install on quit — we handle it ourselves
  autoUpdater.autoInstallOnAppQuit = true;

  // Allow pre-release updates if user opts in (default: stable only)
  autoUpdater.allowPrerelease = false;

  // Allow downgrade (useful for rollbacks)
  autoUpdater.allowDowngrade = false;

  // Set the feed URL to GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'stgLockDown',
    repo: 'DisClone',
    releaseType: 'release'
  });
}

// ============ EVENT HANDLERS ============
function setupEvents() {
  autoUpdater.on('checking-for-update', () => {
    isCheckingForUpdate = true;
    sendStatus('Checking for updates...', 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    isCheckingForUpdate = false;
    updateAvailable = true;
    updateInfo = info;
    const newVersion = info.version;
    const currentVersion = app.getVersion();
    sendStatus(`Update available: v${currentVersion} → v${newVersion}`, 'update-available');
    
    // Auto-download the update immediately
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', (info) => {
    isCheckingForUpdate = false;
    updateAvailable = false;
    sendStatus('App is up to date!', 'up-to-date');
  });

  autoUpdater.on('download-progress', (progress) => {
    downloadProgress = Math.round(progress.percent);
    const mbDownloaded = (progress.transferred / 1048576).toFixed(1);
    const mbTotal = (progress.total / 1048576).toFixed(1);
    const speed = (progress.bytesPerSecond / 1048576).toFixed(1);
    
    sendStatus(
      `Downloading update: ${downloadProgress}% (${mbDownloaded}/${mbTotal} MB @ ${speed} MB/s)`,
      'downloading',
      { percent: downloadProgress, transferred: mbDownloaded, total: mbTotal, speed }
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    updateInfo = info;
    sendStatus(`Update v${info.version} ready — Restarting...`, 'ready');

    // Auto-restart after a brief delay so user sees the message
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 2000);
  });

  autoUpdater.on('error', (err) => {
    isCheckingForUpdate = false;
    const message = err?.message || 'Unknown error';
    
    // Don't show errors for network issues on first launch — just continue
    if (message.includes('net::') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
      sendStatus('Offline — skipping update check', 'skip');
    } else {
      sendStatus(`Update check failed — launching app`, 'error');
      console.error('[AutoUpdater] Error:', message);
    }
  });
}

// ============ IPC HANDLERS ============
function setupIPC() {
  // Renderer can request manual update check
  ipcMain.handle('updater:check', async () => {
    if (isCheckingForUpdate) return { status: 'already-checking' };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: 'ok', updateAvailable, version: result?.updateInfo?.version };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  });

  // Renderer can request to install downloaded update
  ipcMain.on('updater:install', () => {
    if (updateDownloaded) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  // Get current update state
  ipcMain.handle('updater:status', () => ({
    updateAvailable,
    updateDownloaded,
    downloadProgress,
    currentVersion: app.getVersion(),
    updateVersion: updateInfo?.version || null
  }));
}

// ============ HELPERS ============
function setSplashWindow(webContents) {
  splashSender = webContents;
}

function setMainWindow(webContents) {
  mainSender = webContents;
}

function sendStatus(message, type, data = null) {
  const payload = { message, type, data };
  
  if (splashSender && !splashSender.isDestroyed()) {
    splashSender.send('updater-status', payload);
  }
  if (mainSender && !mainSender.isDestroyed()) {
    mainSender.send('updater-status', payload);
  }
}

/**
 * Check for updates. Returns a promise that resolves when:
 * - Update is downloaded and about to install (app will restart)
 * - No update is available (continue to app)
 * - Error occurred (continue to app)
 * - Timeout reached (continue to app)
 */
function checkForUpdates(timeoutMs = 30000) {
  return new Promise((resolve) => {
    let resolved = false;

    const done = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Timeout — don't block the app forever
    const timeout = setTimeout(() => {
      done({ status: 'timeout' });
    }, timeoutMs);

    // Listen for resolution events
    autoUpdater.once('update-not-available', () => {
      clearTimeout(timeout);
      done({ status: 'up-to-date' });
    });

    autoUpdater.once('update-downloaded', (info) => {
      clearTimeout(timeout);
      // Don't resolve — app will restart via quitAndInstall
    });

    autoUpdater.once('error', (err) => {
      clearTimeout(timeout);
      done({ status: 'error', message: err?.message });
    });

    // Start the check
    autoUpdater.checkForUpdates().catch((err) => {
      clearTimeout(timeout);
      done({ status: 'error', message: err?.message });
    });
  });
}

// ============ INIT ============
function init() {
  configure();
  setupEvents();
  setupIPC();
}

module.exports = {
  init,
  checkForUpdates,
  setSplashWindow,
  setMainWindow,
  isUpdateDownloaded: () => updateDownloaded,
  isUpdateAvailable: () => updateAvailable,
  getUpdateInfo: () => updateInfo,
  getProgress: () => downloadProgress
};
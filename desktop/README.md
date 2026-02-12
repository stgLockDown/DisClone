# Nexus Chat — Desktop App

A native desktop client for Nexus Chat that connects to your Railway-hosted server. Get the full desktop experience with system tray, notifications, and keyboard shortcuts while your backend runs in the cloud.

## Features

- **Native Desktop Window** — Runs as a proper Windows/Mac/Linux application
- **System Tray** — Minimize to tray, double-click to restore
- **Desktop Notifications** — Get notified of new messages even when minimized
- **Window State Persistence** — Remembers your window size, position, and maximized state
- **Auto-Reconnect** — Automatically retries if the server is temporarily unavailable
- **Splash Screen** — Beautiful loading screen while connecting to the server
- **Global Shortcut** — `Ctrl+Shift+N` to toggle the window from anywhere
- **Single Instance** — Only one window can run at a time
- **External Links** — Links open in your default browser

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Quick Start

### 1. Install Dependencies

```bash
cd desktop
npm install
```

### 2. Configure Server URL

Edit `config.js` and set your Railway URL:

```javascript
RAILWAY_URL: 'https://your-app-name.up.railway.app',
```

Find your Railway URL in: **Railway Dashboard → Your Project → Settings → Domains**

### 3. Run in Development Mode

```bash
npm start
```

### 4. Build the .exe (Windows)

```bash
npm run build:win
```

Output in `dist/` folder:
- `NexusChat-Setup-3.2.0.exe` — Full installer with Start Menu shortcuts
- `NexusChat-Portable-3.2.0.exe` — Portable version (no install needed)

### 5. Build for Other Platforms

```bash
npm run build:mac    # macOS
npm run build:linux  # Linux
npm run build:all    # All platforms
```

### 6. Automated Builds (GitHub Actions)

The repo includes a GitHub Actions workflow that builds automatically:
- **On tag push**: Push a `v*` tag to trigger builds for all platforms
- **Manual trigger**: Go to Actions → Build Desktop App → Run workflow

Download the `.exe` from the Actions tab → Artifacts section.

## Configuration

All settings in `config.js`:

| Setting | Default | Description |
|---------|---------|-------------|
| `RAILWAY_URL` | `https://disclone-production.up.railway.app` | Your Railway server URL |
| `MINIMIZE_TO_TRAY` | `true` | Minimize to tray instead of closing |
| `START_MINIMIZED` | `false` | Start hidden in system tray |
| `AUTO_LAUNCH` | `false` | Launch on system startup |
| `SHOW_SPLASH` | `true` | Show splash screen while connecting |
| `MAX_RETRIES` | `3` | Connection retry attempts |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+N` | Toggle window visibility (global) |

## System Tray Menu

Right-click the tray icon:
- **Open Nexus Chat** — Show the main window
- **Minimize to Tray** — Toggle tray behavior
- **Notifications** — Toggle desktop notifications
- **Server Status** — Check if the server is online
- **Open in Browser** — Open the web version
- **Quit** — Fully exit the application

## Troubleshooting

### "Could not connect to server"
1. Check that your Railway app is running (visit the URL in a browser)
2. Verify the URL in `config.js` is correct
3. Check your internet connection
4. Click "Retry Connection" on the splash screen

### App won't start
1. Delete `node_modules/` and run `npm install` again
2. Make sure Node.js 18+ is installed: `node --version`
3. Try `npm start` to see console errors

### Build fails
1. On Windows, you may need [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Run `npm run pack` first to test without creating an installer
3. Check that `assets/icon.ico` exists for Windows builds

## Project Structure

```
desktop/
├── assets/
│   ├── icon.png          # App icon (all platforms)
│   └── icon.ico          # Windows icon (multi-size)
├── main.js               # Electron main process
├── preload.js            # Context bridge (secure IPC)
├── config.js             # Server URL & app settings
├── splash.html           # Loading screen
├── splash.css            # Loading screen styles
├── package.json          # Dependencies & build config
├── .gitignore            # Ignore node_modules & dist
└── README.md             # This file
```

## How It Works

1. **Startup** → Electron creates a splash screen
2. **Connection** → Checks Railway server health via `/api/health`
3. **Loading** → Opens the Railway URL in the main window
4. **Running** → Full Nexus Chat experience in a native window
5. **Background** → Minimizes to system tray with notifications

All data lives on the Railway server — the desktop app is a native wrapper providing a seamless desktop experience.
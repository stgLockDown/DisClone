/**
 * Nexus Chat Desktop — Configuration
 * Update RAILWAY_URL to point to your deployed Railway instance.
 */
const path = require('path');

const config = {
  // Your Railway production URL
  RAILWAY_URL: process.env.NEXUS_SERVER_URL || 'https://disclone-production.up.railway.app',

  FALLBACK_URLS: [
    'https://disclone-production.up.railway.app',
    'http://localhost:8080'
  ],

  WINDOW: {
    WIDTH: 1280,
    HEIGHT: 800,
    MIN_WIDTH: 940,
    MIN_HEIGHT: 560,
    BACKGROUND_COLOR: '#0b0e14',
    TITLE: 'Nexus Chat'
  },

  APP: {
    MINIMIZE_TO_TRAY: true,
    START_MINIMIZED: false,
    AUTO_LAUNCH: false,
    SHOW_SPLASH: true,
    SPLASH_TIMEOUT: 15000,
    CONNECTION_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000
  },

  PATHS: {
    ICON: path.join(__dirname, 'assets', 'icon.png'),
    ICON_ICO: path.join(__dirname, 'assets', 'icon.ico'),
    SPLASH: path.join(__dirname, 'splash.html'),
    PRELOAD: path.join(__dirname, 'preload.js')
  }
};

module.exports = config;
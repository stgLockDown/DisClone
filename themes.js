/* ============================================
   NEXUS THEMES - Theme & Color Customization
   ============================================ */

const NexusThemes = (() => {
  // ── Theme Definitions ──
  const THEMES = {
    dark: {
      id: 'dark',
      name: 'Dark',
      emoji: '🌙',
      colors: {
        bg: '#181d28',
        sidebar: '#131720',
        chat: '#181d28',
        text: '#e8ecf4',
        accent: '#0ea5e9',
        muted: '#5c6578'
      }
    },
    light: {
      id: 'light',
      name: 'Light',
      emoji: '☀️',
      colors: {
        bg: '#ffffff',
        sidebar: '#f2f3f5',
        chat: '#ffffff',
        text: '#060607',
        accent: '#0ea5e9',
        muted: '#80848e'
      }
    },
    midnight: {
      id: 'midnight',
      name: 'Midnight',
      emoji: '🌌',
      colors: {
        bg: '#141432',
        sidebar: '#10102a',
        chat: '#141432',
        text: '#e0e0ff',
        accent: '#0ea5e9',
        muted: '#6060aa'
      }
    },
    amoled: {
      id: 'amoled',
      name: 'AMOLED',
      emoji: '⬛',
      colors: {
        bg: '#000000',
        sidebar: '#0a0a0a',
        chat: '#000000',
        text: '#ffffff',
        accent: '#0ea5e9',
        muted: '#606060'
      }
    },
    forest: {
      id: 'forest',
      name: 'Forest',
      emoji: '🌲',
      colors: {
        bg: '#142612',
        sidebar: '#101e0e',
        chat: '#142612',
        text: '#e0f4e0',
        accent: '#22c55e',
        muted: '#5a8a5a'
      }
    },
    sunset: {
      id: 'sunset',
      name: 'Sunset',
      emoji: '🌅',
      colors: {
        bg: '#2a1a10',
        sidebar: '#22140c',
        chat: '#2a1a10',
        text: '#fde8d8',
        accent: '#f97316',
        muted: '#8a6a52'
      }
    },
    ocean: {
      id: 'ocean',
      name: 'Ocean',
      emoji: '🌊',
      colors: {
        bg: '#0e2830',
        sidebar: '#0a2028',
        chat: '#0e2830',
        text: '#d8f4f8',
        accent: '#06b6d4',
        muted: '#5298b0'
      }
    },
    sakura: {
      id: 'sakura',
      name: 'Sakura',
      emoji: '🌸',
      colors: {
        bg: '#2a1424',
        sidebar: '#22101c',
        chat: '#2a1424',
        text: '#fde8f0',
        accent: '#ec4899',
        muted: '#a06888'
      }
    },
    dracula: {
      id: 'dracula',
      name: 'Dracula',
      emoji: '🧛',
      colors: {
        bg: '#282a36',
        sidebar: '#21222c',
        chat: '#282a36',
        text: '#f8f8f2',
        accent: '#bd93f9',
        muted: '#6272a4'
      }
    },
    nord: {
      id: 'nord',
      name: 'Nord',
      emoji: '❄️',
      colors: {
        bg: '#2e3440',
        sidebar: '#242933',
        chat: '#2e3440',
        text: '#eceff4',
        accent: '#88c0d0',
        muted: '#7b88a0'
      }
    },
    solarized: {
      id: 'solarized',
      name: 'Solarized',
      emoji: '🔆',
      colors: {
        bg: '#002b36',
        sidebar: '#002833',
        chat: '#002b36',
        text: '#fdf6e3',
        accent: '#268bd2',
        muted: '#657b83'
      }
    },
    cyberpunk: {
      id: 'cyberpunk',
      name: 'Cyberpunk',
      emoji: '⚡',
      colors: {
        bg: '#141424',
        sidebar: '#10101e',
        chat: '#141424',
        text: '#f0f0ff',
        accent: '#f0e000',
        muted: '#6868a0'
      }
    }
  };

  // ── Accent Colors ──
  const ACCENTS = [
    { id: 'blue',    name: 'Blue',    color: '#0ea5e9' },
    { id: 'purple',  name: 'Purple',  color: '#8b5cf6' },
    { id: 'pink',    name: 'Pink',    color: '#ec4899' },
    { id: 'red',     name: 'Red',     color: '#ef4444' },
    { id: 'orange',  name: 'Orange',  color: '#f97316' },
    { id: 'yellow',  name: 'Yellow',  color: '#eab308' },
    { id: 'green',   name: 'Green',   color: '#22c55e' },
    { id: 'teal',    name: 'Teal',    color: '#14b8a6' },
    { id: 'cyan',    name: 'Cyan',    color: '#06b6d4' },
    { id: 'indigo',  name: 'Indigo',  color: '#6366f1' },
    { id: 'rose',    name: 'Rose',    color: '#f43f5e' },
    { id: 'emerald', name: 'Emerald', color: '#10b981' }
  ];

  // ── State ──
  let currentTheme = 'dark';
  let currentAccent = 'blue';
  let currentFontSize = 14;
  let currentDisplayMode = 'cozy';
  let customCSS = '';
  let customStyleEl = null;

  // ── Persistence ──
  function loadPreferences() {
    try {
      const saved = localStorage.getItem('nexus-theme-prefs');
      if (saved) {
        const prefs = JSON.parse(saved);
        currentTheme = prefs.theme || 'dark';
        currentAccent = prefs.accent || 'blue';
        currentFontSize = prefs.fontSize || 14;
        currentDisplayMode = prefs.displayMode || 'cozy';
        customCSS = prefs.customCSS || '';
      }
    } catch (e) {
      console.warn('Failed to load theme preferences:', e);
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem('nexus-theme-prefs', JSON.stringify({
        theme: currentTheme,
        accent: currentAccent,
        fontSize: currentFontSize,
        displayMode: currentDisplayMode,
        customCSS: customCSS
      }));
    } catch (e) {
      console.warn('Failed to save theme preferences:', e);
    }
  }

  // ── Theme Application ──
  function applyTheme(themeId, skipTransition) {
    const root = document.documentElement;

    if (!skipTransition) {
      root.classList.add('theme-transitioning');
      setTimeout(() => root.classList.remove('theme-transitioning'), 400);
    }

    // Remove old theme
    delete root.dataset.theme;

    // Apply new theme (dark is default, no data-theme needed)
    if (themeId !== 'dark') {
      root.dataset.theme = themeId;
    }

    currentTheme = themeId;

    // Some themes have built-in accent colors - only override if user picked a non-default accent
    // or if theme doesn't define its own accent
    applyAccent(currentAccent, true);

    savePreferences();
    updatePreviewIfVisible();
  }

  function applyAccent(accentId, skipSave) {
    const root = document.documentElement;

    // Themes that define their own accent colors
    const themeAccentMap = {
      forest: 'green',
      sunset: 'orange',
      ocean: 'cyan',
      sakura: 'pink',
      cyberpunk: 'yellow'
    };

    // If accent is 'blue' (default) and theme has its own accent, don't override
    const themeDefaultAccent = themeAccentMap[currentTheme];

    delete root.dataset.accent;

    if (accentId !== 'blue' || !themeDefaultAccent) {
      root.dataset.accent = accentId;
    }

    currentAccent = accentId;

    if (!skipSave) {
      savePreferences();
      updatePreviewIfVisible();
    }
  }

  function applyFontSize(size) {
    currentFontSize = size;
    document.documentElement.style.setProperty('--chat-font-size', size + 'px');

    // Apply to messages
    const messagesArea = document.querySelector('.messages-scroller');
    if (messagesArea) {
      messagesArea.style.fontSize = size + 'px';
    }

    savePreferences();
    updatePreviewIfVisible();
  }

  function applyDisplayMode(mode) {
    currentDisplayMode = mode;
    document.body.classList.remove('display-cozy', 'display-compact');
    document.body.classList.add('display-' + mode);
    savePreferences();
    updatePreviewIfVisible();
  }

  function applyCustomCSS(css) {
    customCSS = css;

    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'nexus-custom-css';
      document.head.appendChild(customStyleEl);
    }

    customStyleEl.textContent = css;
    savePreferences();
  }

  // ── Theme Preview Rendering ──
  function renderThemePreview(theme) {
    const c = theme.colors;
    return `
      <div class="theme-preview" style="background:${c.bg};">
        <div class="theme-preview-sidebar" style="background:${c.sidebar};">
          <div class="tp-dot" style="background:${c.accent};"></div>
          <div class="tp-dot" style="background:${c.muted};"></div>
          <div class="tp-dot" style="background:${c.muted};"></div>
          <div class="tp-dot" style="background:${c.muted};"></div>
        </div>
        <div class="theme-preview-chat" style="background:${c.bg};">
          <div class="tp-msg">
            <div class="tp-avatar" style="background:${c.accent};"></div>
            <div class="tp-lines">
              <div class="tp-line" style="background:${c.text};width:60%;"></div>
              <div class="tp-line" style="background:${c.text};width:85%;"></div>
            </div>
          </div>
          <div class="tp-msg">
            <div class="tp-avatar" style="background:${c.muted};"></div>
            <div class="tp-lines">
              <div class="tp-line" style="background:${c.text};width:45%;"></div>
              <div class="tp-line" style="background:${c.text};width:70%;"></div>
            </div>
          </div>
        </div>
        <div class="theme-preview-members" style="background:${c.sidebar};">
          <div class="tp-member"><div class="tp-member-dot" style="background:#22c55e;"></div><div class="tp-member-line" style="background:${c.text};"></div></div>
          <div class="tp-member"><div class="tp-member-dot" style="background:#f59e0b;"></div><div class="tp-member-line" style="background:${c.text};"></div></div>
          <div class="tp-member"><div class="tp-member-dot" style="background:${c.muted};"></div><div class="tp-member-line" style="background:${c.text};"></div></div>
        </div>
      </div>`;
  }

  // ── Appearance Settings HTML ──
  function renderAppearanceSection() {
    const themeCards = Object.values(THEMES).map(t => `
      <div class="theme-card ${t.id === currentTheme ? 'active' : ''}" data-theme-id="${t.id}" onclick="NexusThemes.selectTheme('${t.id}')">
        ${renderThemePreview(t)}
        <div class="theme-card-name">${t.emoji} ${t.name}</div>
      </div>
    `).join('');

    const accentSwatches = ACCENTS.map(a => `
      <div class="accent-swatch ${a.id === currentAccent ? 'active' : ''}" 
           data-accent-id="${a.id}"
           style="background:${a.color};" 
           title="${a.name}"
           onclick="NexusThemes.selectAccent('${a.id}')">
      </div>
    `).join('');

    return `
      <div class="settings-section appearance-section">
        <h2>Appearance</h2>
        <p style="color:var(--text-muted);margin-bottom:24px;">Personalize Nexus with themes, accent colors, and display preferences.</p>

        <!-- Theme Selection -->
        <div class="appearance-card">
          <h3>Theme</h3>
          <div class="theme-grid" id="themeGrid">
            ${themeCards}
          </div>
          <div class="theme-sync-note">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            Theme preferences are saved locally and applied automatically.
          </div>
        </div>

        <!-- Accent Color -->
        <div class="appearance-card">
          <h3>Accent Color</h3>
          <div class="accent-grid" id="accentGrid">
            ${accentSwatches}
          </div>
        </div>

        <!-- Font Size -->
        <div class="appearance-card">
          <h3>Chat Font Size</h3>
          <div class="font-size-control">
            <span style="font-size:12px;color:var(--text-muted);">A</span>
            <input type="range" class="font-size-slider" id="fontSizeSlider" 
                   min="12" max="20" value="${currentFontSize}" step="1"
                   oninput="NexusThemes.changeFontSize(this.value)">
            <span style="font-size:20px;color:var(--text-muted);">A</span>
            <div class="font-size-value" id="fontSizeValue">${currentFontSize}px</div>
          </div>
          <div class="font-size-labels">
            <span>12px</span>
            <span>14px</span>
            <span>16px</span>
            <span>18px</span>
            <span>20px</span>
          </div>
        </div>

        <!-- Message Display -->
        <div class="appearance-card">
          <h3>Message Display</h3>
          <div class="display-mode-group">
            <div class="display-mode-btn ${currentDisplayMode === 'cozy' ? 'active' : ''}" onclick="NexusThemes.selectDisplayMode('cozy')">
              <div class="dm-icon">💬</div>
              <div class="dm-label">Cozy</div>
              <div class="dm-desc">Modern look with avatars</div>
            </div>
            <div class="display-mode-btn ${currentDisplayMode === 'compact' ? 'active' : ''}" onclick="NexusThemes.selectDisplayMode('compact')">
              <div class="dm-icon">📋</div>
              <div class="dm-label">Compact</div>
              <div class="dm-desc">Fits more messages on screen</div>
            </div>
          </div>
        </div>

        <!-- Live Preview -->
        <div class="appearance-card">
          <h3>Preview</h3>
          <div class="theme-chat-preview ${currentDisplayMode === 'compact' ? 'compact' : ''}" id="themeChatPreview">
            <div class="preview-label">Chat Preview</div>
            <div class="preview-msg">
              <div class="preview-avatar" style="background:var(--nexus-primary);">🥷</div>
              <div class="preview-body">
                <div class="preview-name" style="color:var(--nexus-primary);">NinjaDev <span class="preview-timestamp">Today at 3:42 PM</span></div>
                <div class="preview-text">Hey everyone! Check out the new theme system 🎨</div>
              </div>
            </div>
            <div class="preview-msg">
              <div class="preview-avatar" style="background:#8b5cf6;">🤖</div>
              <div class="preview-body">
                <div class="preview-name" style="color:#8b5cf6;">NexusBot <span class="preview-timestamp">Today at 3:43 PM</span></div>
                <div class="preview-text">Looking great! The accent colors really pop with this theme. 🚀</div>
              </div>
            </div>
            <div class="preview-msg">
              <div class="preview-avatar" style="background:#22c55e;">🎮</div>
              <div class="preview-body">
                <div class="preview-name" style="color:#22c55e;">GamerPro <span class="preview-timestamp">Today at 3:44 PM</span></div>
                <div class="preview-text">I'm loving the Cyberpunk theme with the yellow accent! ⚡</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom CSS -->
        <div class="appearance-card">
          <h3>Custom CSS</h3>
          <p style="color:var(--text-muted);font-size:12px;margin-bottom:10px;">Advanced: Add your own CSS to further customize the look. Changes apply instantly.</p>
          <textarea class="custom-css-textarea" id="customCSSInput" 
                    placeholder="/* Your custom CSS here */&#10;.messages-scroller {&#10;  /* example */&#10;}" 
                    oninput="NexusThemes.previewCustomCSS(this.value)">${customCSS}</textarea>
          <div class="custom-css-actions">
            <button class="btn btn-secondary" onclick="NexusThemes.clearCustomCSS()">Clear</button>
            <button class="btn btn-primary" onclick="NexusThemes.saveCustomCSS()">Apply & Save</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── UI Interaction Handlers ──
  function selectTheme(themeId) {
    if (!THEMES[themeId]) return;
    applyTheme(themeId);

    // Update UI
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.themeId === themeId);
    });

    if (typeof showToast === 'function') {
      showToast(`Theme changed to ${THEMES[themeId].emoji} ${THEMES[themeId].name}`, 'success');
    }
  }

  function selectAccent(accentId) {
    applyAccent(accentId);

    // Update UI
    document.querySelectorAll('.accent-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch.dataset.accentId === accentId);
    });

    const accent = ACCENTS.find(a => a.id === accentId);
    if (accent && typeof showToast === 'function') {
      showToast(`Accent color changed to ${accent.name}`, 'success');
    }
  }

  function changeFontSize(value) {
    const size = parseInt(value);
    applyFontSize(size);

    const label = document.getElementById('fontSizeValue');
    if (label) label.textContent = size + 'px';
  }

  function selectDisplayMode(mode) {
    applyDisplayMode(mode);

    // Update buttons
    document.querySelectorAll('.display-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Update preview
    const preview = document.getElementById('themeChatPreview');
    if (preview) {
      preview.classList.toggle('compact', mode === 'compact');
    }
  }

  function previewCustomCSS(css) {
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'nexus-custom-css';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = css;
  }

  function saveCustomCSS() {
    const textarea = document.getElementById('customCSSInput');
    if (textarea) {
      applyCustomCSS(textarea.value);
      if (typeof showToast === 'function') {
        showToast('Custom CSS saved!', 'success');
      }
    }
  }

  function clearCustomCSS() {
    const textarea = document.getElementById('customCSSInput');
    if (textarea) textarea.value = '';
    applyCustomCSS('');
    if (typeof showToast === 'function') {
      showToast('Custom CSS cleared', 'success');
    }
  }

  function updatePreviewIfVisible() {
    const preview = document.getElementById('themeChatPreview');
    if (preview) {
      preview.style.fontSize = currentFontSize + 'px';
      preview.classList.toggle('compact', currentDisplayMode === 'compact');
    }
  }

  // ── Initialization ──
  function init() {
    loadPreferences();

    // Apply saved theme immediately (no transition on load)
    applyTheme(currentTheme, true);
    applyFontSize(currentFontSize);
    applyDisplayMode(currentDisplayMode);

    if (customCSS) {
      applyCustomCSS(customCSS);
    }

    // Hook into settings section switching
    hookSettingsAppearance();

    console.log(`🎨 NexusThemes initialized — Theme: ${currentTheme}, Accent: ${currentAccent}`);
  }

  function hookSettingsAppearance() {
    // Override the appearance section in settings
    const origSwitchSection = window.switchSettingsSection;

    if (typeof origSwitchSection === 'function') {
      window.switchSettingsSection = function(section) {
        if (section === 'appearance') {
          // Render our custom appearance section
          const content = document.getElementById('settingsContent');
          if (content) {
            content.innerHTML = renderAppearanceSection();
          }

          // Update nav active state
          document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === 'appearance');
          });
          return;
        }
        origSwitchSection(section);
      };
    }

    // Also patch the sections object if accessible
    // We'll intercept via MutationObserver as backup
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const content = document.getElementById('settingsContent');
          if (content) {
            const h2 = content.querySelector('h2');
            if (h2 && h2.textContent === 'Appearance') {
              // Check if it's the old placeholder
              const oldThemeBoxes = content.querySelectorAll('[title="Dark"], [title="Light"], [title="Midnight"]');
              if (oldThemeBoxes.length > 0 && !content.querySelector('.appearance-section')) {
                content.innerHTML = renderAppearanceSection();
              }
            }
          }
        }
      }
    });

    const settingsContent = document.getElementById('settingsContent');
    if (settingsContent) {
      observer.observe(settingsContent, { childList: true, subtree: false });
    }

    // Also observe for settings overlay becoming visible
    const settingsOverlay = document.getElementById('settingsOverlay') || document.querySelector('.settings-overlay');
    if (settingsOverlay) {
      const visObserver = new MutationObserver(() => {
        const isVisible = settingsOverlay.classList.contains('active') || 
                          settingsOverlay.style.display !== 'none';
        if (isVisible) {
          const activeNav = document.querySelector('.settings-nav-item.active');
          if (activeNav && activeNav.dataset.section === 'appearance') {
            const content = document.getElementById('settingsContent');
            if (content && !content.querySelector('.appearance-section')) {
              content.innerHTML = renderAppearanceSection();
            }
          }
        }
      });
      visObserver.observe(settingsOverlay, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  // ── Auto-init on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure app.js has loaded
    setTimeout(init, 100);
  }

  // ── Public API ──
  return {
    selectTheme,
    selectAccent,
    changeFontSize,
    selectDisplayMode,
    previewCustomCSS,
    saveCustomCSS,
    clearCustomCSS,
    renderAppearanceSection,
    getThemes: () => THEMES,
    getAccents: () => ACCENTS,
    getCurrentTheme: () => currentTheme,
    getCurrentAccent: () => currentAccent,
    getCurrentFontSize: () => currentFontSize,
    getCurrentDisplayMode: () => currentDisplayMode,
    applyTheme,
    applyAccent,
    init
  };
})();

// Expose globally
window.NexusThemes = NexusThemes;
// src/js/themeToggle.js
// SolteX — App-wide Light/Dark Theme Toggle

const STORAGE_KEY = 'soltex-app-theme';
let _onToggleCallbacks = [];

/**
 * Apply the theme immediately (call from inline <script> to prevent FOUC).
 */
export function applyStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/** Returns true if current app theme is dark */
export function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Register a callback to be invoked when theme toggles.
 * Callback receives (isDark: boolean).
 */
export function onThemeToggle(cb) {
  _onToggleCallbacks.push(cb);
}

/**
 * Initialize the theme toggle button.
 */
export function initThemeToggle() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;

  updateToggleIcon(btn);

  btn.addEventListener('click', () => {
    const wasDark = isDarkMode();
    if (wasDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(STORAGE_KEY, 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(STORAGE_KEY, 'dark');
    }
    updateToggleIcon(btn);

    // Re-create Lucide icons so they pick up new colors
    if (window.lucide) window.lucide.createIcons();

    // Notify listeners (editor theme sync)
    const nowDark = isDarkMode();
    _onToggleCallbacks.forEach(cb => cb(nowDark));
  });
}

function updateToggleIcon(btn) {
  const dark = isDarkMode();
  const icon = btn.querySelector('[data-lucide]');
  if (icon) {
    icon.setAttribute('data-lucide', dark ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  }
}

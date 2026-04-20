# Features 6.7, 6.8 — Auto-Save & Settings Panel

> **Phase**: 6 | **Features**: 7, 8
> **Goal**: (6.7) Periodic auto-save to disk to prevent data loss. (6.8) A comprehensive settings panel for all editor and compiler preferences.
> **Estimated Effort**: 7–10 hours total
> **Dependencies**: Feature 1.2 (editor), Feature 3.1 (auto-compile settings).

---

## Feature 6.7 — Auto-Save (Periodic)

### Overview

Auto-save writes the current editor content to disk every N seconds. This is NOT a checkpoint — no Git commit. It simply prevents data loss if the browser crashes or the user navigates away.

### File: `src/js/autoSave.js`

```javascript
// src/js/autoSave.js
import { getEditorView } from "./editor.js";

let autoSaveInterval = null;
let lastSavedContent = "";
let lastSaveTime = null;
let isEnabled = true;
let intervalMs = 5000; // Default: 5 seconds

/**
 * Initialize auto-save.
 */
export function initAutoSave(project, filePath) {
  stopAutoSave();

  autoSaveInterval = setInterval(() => {
    if (!isEnabled) return;
    performAutoSave(project, filePath);
  }, intervalMs);

  console.log(`Auto-save initialized: every ${intervalMs / 1000}s`);
}

/**
 * Stop auto-save (e.g., when switching files/projects).
 */
export function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

/**
 * Perform a single auto-save.
 */
async function performAutoSave(project, filePath) {
  const view = getEditorView();
  if (!view) return;

  const currentContent = view.state.doc.toString();

  // Skip if nothing changed
  if (currentContent === lastSavedContent) return;

  try {
    await fetch(`/api/projects/${project}/file`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content: currentContent }),
    });

    lastSavedContent = currentContent;
    lastSaveTime = Date.now();
    updateAutoSaveIndicator();
  } catch (err) {
    console.error("Auto-save failed:", err);
  }
}

/**
 * Update the status bar indicator.
 */
function updateAutoSaveIndicator() {
  const el = document.getElementById("autosave-status");
  if (!el) return;

  if (lastSaveTime) {
    el.textContent = "Saved";
    el.classList.add("saved");
    // After 3 seconds, show relative time
    setTimeout(() => {
      if (lastSaveTime) {
        const secsAgo = Math.round((Date.now() - lastSaveTime) / 1000);
        el.textContent = secsAgo < 60 ? `Saved ${secsAgo}s ago` : "Saved";
      }
    }, 3000);
  }
}

/**
 * Configure auto-save settings.
 */
export function configureAutoSave(enabled, interval) {
  isEnabled = enabled;
  intervalMs = interval * 1000; // Convert seconds to ms
}

/**
 * Mark content as dirty (unsaved indicator).
 */
export function markDirty() {
  const el = document.getElementById("autosave-status");
  if (el) {
    el.textContent = "Unsaved";
    el.classList.remove("saved");
  }
}
```

### Status Bar HTML

```html
<!-- Add to status bar -->
<span id="autosave-status" class="autosave-status">—</span>
```

### CSS

```css
.autosave-status {
  font-size: var(--font-size-xs);
  color: var(--text-placeholder);
  transition: color var(--transition-fast);
}
.autosave-status.saved {
  color: var(--accent-success);
}
```

---

## Feature 6.8 — Settings Panel

### Overview

A modal overlay with organized sections for all configurable preferences. Settings are persisted in `localStorage` and applied on page load.

### Settings Schema

```javascript
const DEFAULT_SETTINGS = {
  // Editor
  fontSize: 14, // px
  fontFamily: "JetBrains Mono", // or 'Fira Code', 'Source Code Pro'
  lineHeight: 1.6,
  wordWrap: true,
  keybindingMode: "default", // 'default' | 'vim' | 'emacs'
  autoCloseBrackets: true,
  showLineNumbers: true,

  // Compilation
  texEngine: "pdflatex", // 'pdflatex' | 'xelatex' | 'lualatex'
  autoCompile: true,
  autoCompileDelay: 3, // seconds
  draftMode: false,

  // Spell Check
  spellCheckEnabled: true,
  spellCheckLanguage: "en_US",

  // Auto-Save
  autoSaveEnabled: true,
  autoSaveInterval: 5, // seconds

  // Theme
  theme: "dark", // 'dark' | 'light' (Phase 7 adds more)
};
```

### Step 1: Settings Manager

### File: `src/js/settings.js`

```javascript
// src/js/settings.js

const STORAGE_KEY = "soltex-settings";
let currentSettings = {};

/**
 * Load settings from localStorage.
 */
export function loadSettings() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  } else {
    currentSettings = { ...DEFAULT_SETTINGS };
  }

  applySettings();
  return currentSettings;
}

/**
 * Save settings to localStorage.
 */
export function saveSettings(newSettings) {
  currentSettings = { ...currentSettings, ...newSettings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  applySettings();
}

/**
 * Get current settings.
 */
export function getSettings() {
  return { ...currentSettings };
}

/**
 * Get a single setting value.
 */
export function getSetting(key) {
  return currentSettings[key] ?? DEFAULT_SETTINGS[key];
}

/**
 * Apply all settings to the editor and UI.
 */
function applySettings() {
  const s = currentSettings;

  // Editor font
  document.documentElement.style.setProperty(
    "--editor-font-size",
    `${s.fontSize}px`,
  );
  document.documentElement.style.setProperty(
    "--editor-font-family",
    s.fontFamily,
  );
  document.documentElement.style.setProperty(
    "--editor-line-height",
    s.lineHeight,
  );

  // Word wrap — dispatched as an event so editor.js can reconfigure
  document.dispatchEvent(
    new CustomEvent("setting-changed", {
      detail: { key: "wordWrap", value: s.wordWrap },
    }),
  );

  // Keybinding mode
  document.dispatchEvent(
    new CustomEvent("setting-changed", {
      detail: { key: "keybindingMode", value: s.keybindingMode },
    }),
  );

  // Auto-compile
  document.dispatchEvent(
    new CustomEvent("setting-changed", {
      detail: { key: "autoCompile", value: s.autoCompile },
    }),
  );

  // Spell check
  document.dispatchEvent(
    new CustomEvent("setting-changed", {
      detail: { key: "spellCheckEnabled", value: s.spellCheckEnabled },
    }),
  );

  console.log("Settings applied");
}
```

---

### Step 2: Settings Modal HTML

```html
<div id="settings-modal" class="modal-overlay" style="display: none;">
  <div class="modal-box settings-modal">
    <div class="settings-header">
      <h2 class="modal-title">Settings</h2>
      <button class="btn btn-icon-only settings-close" title="Close">✕</button>
    </div>

    <div class="settings-body">
      <!-- Editor Section -->
      <section class="settings-section">
        <h3 class="settings-section-title">Editor</h3>

        <div class="setting-row">
          <label>Font Size</label>
          <input
            id="set-font-size"
            type="number"
            min="8"
            max="32"
            step="1"
            class="setting-input"
          />
        </div>

        <div class="setting-row">
          <label>Font Family</label>
          <select id="set-font-family" class="setting-select">
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Fira Code">Fira Code</option>
            <option value="Source Code Pro">Source Code Pro</option>
            <option value="Cascadia Code">Cascadia Code</option>
            <option value="monospace">System Monospace</option>
          </select>
        </div>

        <div class="setting-row">
          <label>Line Height</label>
          <input
            id="set-line-height"
            type="number"
            min="1.0"
            max="2.5"
            step="0.1"
            class="setting-input"
          />
        </div>

        <div class="setting-row">
          <label>Word Wrap</label>
          <input id="set-word-wrap" type="checkbox" class="setting-toggle" />
        </div>

        <div class="setting-row">
          <label>Keybinding Mode</label>
          <select id="set-keybinding" class="setting-select">
            <option value="default">Default</option>
            <option value="vim">Vim</option>
            <option value="emacs">Emacs</option>
          </select>
        </div>

        <div class="setting-row">
          <label>Auto-Close Brackets</label>
          <input
            id="set-auto-brackets"
            type="checkbox"
            class="setting-toggle"
          />
        </div>
      </section>

      <!-- Compilation Section -->
      <section class="settings-section">
        <h3 class="settings-section-title">Compilation</h3>

        <div class="setting-row">
          <label>TeX Engine</label>
          <select id="set-tex-engine" class="setting-select">
            <option value="pdflatex">pdfLaTeX</option>
            <option value="xelatex">XeLaTeX</option>
            <option value="lualatex">LuaLaTeX</option>
          </select>
        </div>

        <div class="setting-row">
          <label>Auto-Compile</label>
          <input id="set-auto-compile" type="checkbox" class="setting-toggle" />
        </div>

        <div class="setting-row">
          <label>Auto-Compile Delay (seconds)</label>
          <input
            id="set-compile-delay"
            type="number"
            min="1"
            max="30"
            step="1"
            class="setting-input"
          />
        </div>
      </section>

      <!-- Spell Check Section -->
      <section class="settings-section">
        <h3 class="settings-section-title">Spell Check</h3>

        <div class="setting-row">
          <label>Enabled</label>
          <input
            id="set-spell-enabled"
            type="checkbox"
            class="setting-toggle"
          />
        </div>
      </section>

      <!-- Auto-Save Section -->
      <section class="settings-section">
        <h3 class="settings-section-title">Auto-Save</h3>

        <div class="setting-row">
          <label>Enabled</label>
          <input
            id="set-autosave-enabled"
            type="checkbox"
            class="setting-toggle"
          />
        </div>

        <div class="setting-row">
          <label>Interval (seconds)</label>
          <input
            id="set-autosave-interval"
            type="number"
            min="1"
            max="60"
            step="1"
            class="setting-input"
          />
        </div>
      </section>
    </div>
  </div>
</div>
```

---

### Step 3: Settings Modal Wiring

```javascript
// In settings.js — modal interaction:

const SETTINGS_MAP = [
  // [element ID, setting key, type]
  ["set-font-size", "fontSize", "number"],
  ["set-font-family", "fontFamily", "select"],
  ["set-line-height", "lineHeight", "number"],
  ["set-word-wrap", "wordWrap", "checkbox"],
  ["set-keybinding", "keybindingMode", "select"],
  ["set-auto-brackets", "autoCloseBrackets", "checkbox"],
  ["set-tex-engine", "texEngine", "select"],
  ["set-auto-compile", "autoCompile", "checkbox"],
  ["set-compile-delay", "autoCompileDelay", "number"],
  ["set-spell-enabled", "spellCheckEnabled", "checkbox"],
  ["set-autosave-enabled", "autoSaveEnabled", "checkbox"],
  ["set-autosave-interval", "autoSaveInterval", "number"],
];

/**
 * Open settings modal — populate inputs from current settings.
 */
export function openSettings() {
  const modal = document.getElementById("settings-modal");
  modal.style.display = "flex";

  const s = getSettings();
  for (const [id, key, type] of SETTINGS_MAP) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (type === "checkbox") el.checked = s[key];
    else el.value = s[key];
  }
}

/**
 * Close settings modal — read all inputs and save.
 */
function closeSettings() {
  const modal = document.getElementById("settings-modal");
  modal.style.display = "none";

  const newSettings = {};
  for (const [id, key, type] of SETTINGS_MAP) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (type === "checkbox") newSettings[key] = el.checked;
    else if (type === "number") newSettings[key] = parseFloat(el.value);
    else newSettings[key] = el.value;
  }

  saveSettings(newSettings);
}

/**
 * Initialize settings modal event handlers.
 */
export function initSettingsModal() {
  // Open button
  document
    .getElementById("btn-settings")
    ?.addEventListener("click", openSettings);

  // Close button
  document
    .querySelector(".settings-close")
    ?.addEventListener("click", closeSettings);

  // Click outside to close
  document.getElementById("settings-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "settings-modal") closeSettings();
  });

  // Escape to close
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.getElementById("settings-modal").style.display !== "none"
    ) {
      closeSettings();
    }
  });

  // Live preview — apply changes as user edits (don't wait for close)
  for (const [id, key, type] of SETTINGS_MAP) {
    const el = document.getElementById(id);
    if (!el) continue;
    const event = type === "checkbox" ? "change" : "input";
    el.addEventListener(event, () => {
      const value =
        type === "checkbox"
          ? el.checked
          : type === "number"
            ? parseFloat(el.value)
            : el.value;
      saveSettings({ [key]: value });
    });
  }
}
```

### Toolbar Button

```html
<button id="btn-settings" class="btn btn-toolbar" title="Settings">
  <span class="btn-icon">⚙</span>
</button>
```

---

### Step 4: CSS for Settings Modal

```css
/* Settings Modal */
.settings-modal {
  max-width: 500px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.settings-body {
  overflow-y: auto;
  padding: 16px 20px;
  flex: 1;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.setting-row label {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.setting-input {
  width: 80px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
  text-align: right;
}

.setting-input:focus {
  border-color: var(--accent-primary);
  outline: none;
}

.setting-select {
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.setting-select:focus {
  border-color: var(--accent-primary);
  outline: none;
}

/* Custom toggle switch */
.setting-toggle {
  appearance: none;
  width: 36px;
  height: 20px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.setting-toggle::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-secondary);
  top: 2px;
  left: 2px;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast);
}

.setting-toggle:checked {
  background: var(--accent-primary);
}
.setting-toggle:checked::after {
  transform: translateX(16px);
  background: white;
}
```

---

### Step 5: Editor Responds to Settings

In `editor.js`, listen for setting changes and reconfigure CodeMirror:

```javascript
import { getSetting } from "./settings.js";

document.addEventListener("setting-changed", (e) => {
  const { key, value } = e.detail;

  switch (key) {
    case "wordWrap":
      // Reconfigure: add or remove lineWrapping extension
      if (value) {
        editorView.dispatch({ effects: addLineWrapping.of(null) });
      } else {
        editorView.dispatch({ effects: removeLineWrapping.of(null) });
      }
      break;

    case "keybindingMode":
      // Reconfigure keybinding compartment
      editorView.dispatch({
        effects: keybindingCompartment.reconfigure(
          value === "vim"
            ? vim()
            : value === "emacs"
              ? emacs()
              : keymap.of(defaultKeymap),
        ),
      });
      break;

    case "autoCompile":
      // Toggle auto-compile module
      setAutoCompileEnabled(value);
      break;

    case "spellCheckEnabled":
      // Toggle spell checker
      toggleSpellChecker(value);
      break;
  }
});

// Font settings are applied via CSS custom properties — no JS needed.
// The editor inherits font-size, font-family, and line-height from CSS vars.
```

**Key**: Font settings work via CSS variables (`--editor-font-size`, etc.). CodeMirror reads from these variables via theme CSS. No JavaScript dispatch needed for font changes — they're instant.

---

## Edge Cases

### Auto-Save

- **Auto-save during compilation**: No conflict. File write and latexmk read are separate processes. Node.js `writeFile` is atomic enough.
- **Switching files**: Call `stopAutoSave()` when switching, then `initAutoSave()` with the new file path.
- **Auto-save with no changes**: The `lastSavedContent` comparison prevents unnecessary writes.
- **Browser crash**: Last auto-save is on disk. No data lost (within the interval window).

### Settings

- **Invalid font size (0 or 999)**: The input has `min="8" max="32"`. HTML validation handles it.
- **Unknown font family**: Falls back to `monospace` (browser default for code).
- **Vim/Emacs packages not installed**: Feature 2.8 lists them as optional npm packages. If not installed, the select option is disabled.
- **Settings conflict with project.json**: Project-level `texEngine` in `project.json` takes priority over global settings. The settings modal shows the effective value.
- **localStorage cleared**: Falls back to `DEFAULT_SETTINGS`. No crash.
- **Live preview of settings**: Changes apply immediately as the user adjusts inputs — no "Save" button needed. Closing the modal persists everything.

---

## Final Acceptance Checklist — Features 6.7 & 6.8

| #   | Check                                             | Status |
| --- | ------------------------------------------------- | ------ |
| 1   | Auto-save writes to disk every N seconds          | ☐      |
| 2   | Status bar shows "Saved" / "Saved Xs ago"         | ☐      |
| 3   | No save when content hasn't changed               | ☐      |
| 4   | Auto-save stops when switching files              | ☐      |
| 5   | ⚙ button opens settings modal                     | ☐      |
| 6   | Font size slider changes editor font immediately  | ☐      |
| 7   | Font family dropdown works                        | ☐      |
| 8   | Word wrap toggle wraps/unwraps editor             | ☐      |
| 9   | Keybinding mode switch (Default/Vim/Emacs)        | ☐      |
| 10  | TeX engine dropdown changes compilation engine    | ☐      |
| 11  | Auto-compile toggle enables/disables auto-compile | ☐      |
| 12  | Spell check toggle enables/disables underlines    | ☐      |
| 13  | Auto-save interval is configurable                | ☐      |
| 14  | Settings persist across page reloads              | ☐      |
| 15  | Escape/click outside closes settings modal        | ☐      |
| 16  | Toggle switches have custom styling (pill shape)  | ☐      |

> **Phase 6 is DONE when all feature checklists pass. Run the Phase 6 Integration Test Plan.**

# Features 3.5, 3.6, 3.7 — Error Log Panel, Clickable Errors, & Badge

> **Phase**: 3 | **Features**: 5, 6, 7 (tightly coupled — built together)
> **Goal**: Parse the LaTeX `.log` file, display errors/warnings in a structured panel, make each entry clickable (jumps to source line), and show error/warning counts as a badge.
> **Estimated Effort**: 5–8 hours total
> **Dependencies**: Feature 1.3 (compile response includes `log` text), Feature 1.2 (editor `getEditorView()` for line navigation).

---

## Overview

This is the biggest chunk of Phase 3. Three sub-features are built together because they share the same data pipeline:

```
Compile response → logParser.js → structured entries → logPanel.js → UI
                                       ↓                      ↓
                                  badge counts          click → editor.goToLine()
```

### New Files
| File | Purpose |
|------|---------|
| `src/js/logParser.js` | Parse raw LaTeX log text into structured entries |
| `src/js/logPanel.js` | Render the log panel UI, handle clicks, update badge |

---

## Step 1: Create the LaTeX Log Parser

### What to Do
Build `src/js/logParser.js` — a module that takes raw `.log` file text and extracts structured error/warning/info entries.

### LaTeX Log Format

LaTeX logs have three types of messages we care about:

#### Errors
```
! Undefined control sequence.
l.42 \undefcommand
```
Pattern: Line starting with `! ` followed by the error message. The next line(s) contain `l.<number>` (the line number).

#### Warnings
```
LaTeX Warning: Reference `fig:missing' on page 3 undefined on input line 58.
```
Pattern: `LaTeX Warning:` or `Package <name> Warning:` followed by the message. Line number is in the text: `on input line <N>`.

#### Overfull/Underfull boxes (badboxes)
```
Overfull \hbox (3.45pt too wide) in paragraph at lines 23--25
Underfull \vbox (badness 10000) has occurred while \output is active
```
Pattern: `Overfull` or `Underfull` followed by `\hbox` or `\vbox`. Line number may be in `at lines <N>--<M>`.

### Parser Implementation

```javascript
// src/js/logParser.js

/**
 * @typedef {Object} LogEntry
 * @property {'error'|'warning'|'badbox'} type
 * @property {string} message - The human-readable message
 * @property {number|null} line - Source line number (null if unknown)
 * @property {string} raw - The raw log text for this entry
 */

/**
 * Parse a LaTeX log string into structured entries.
 * @param {string} logText - Raw log file content
 * @returns {LogEntry[]}
 */
export function parseLatexLog(logText) {
  const entries = [];
  const lines = logText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Errors: lines starting with "! "
    if (line.startsWith('! ')) {
      const message = line.substring(2).trim();
      let sourceLine = null;
      let raw = line;

      // Look ahead for "l.<number>" on the next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        raw += '\n' + lines[j];
        const lineMatch = lines[j].match(/^l\.(\d+)\s/);
        if (lineMatch) {
          sourceLine = parseInt(lineMatch[1], 10);
          break;
        }
      }

      entries.push({ type: 'error', message, line: sourceLine, raw });
      continue;
    }

    // 2. Warnings: "LaTeX Warning:" or "Package <name> Warning:"
    if (line.includes('Warning:')) {
      const warningMatch = line.match(/(LaTeX Warning|Package \w+ Warning):\s*(.*)/);
      if (warningMatch) {
        let message = warningMatch[2].trim();
        let raw = line;

        // Warning may span multiple lines — continue until empty line or next message
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '' && !lines[j].startsWith('!') && !lines[j].includes('Warning:')) {
          message += ' ' + lines[j].trim();
          raw += '\n' + lines[j];
          j++;
        }

        // Extract line number from message text
        let sourceLine = null;
        const lineInText = message.match(/on input line (\d+)/);
        if (lineInText) {
          sourceLine = parseInt(lineInText[1], 10);
        }

        entries.push({ type: 'warning', message, line: sourceLine, raw });
        continue;
      }
    }

    // 3. Badboxes: "Overfull" or "Underfull"
    if (line.startsWith('Overfull') || line.startsWith('Underfull')) {
      const message = line.trim();
      let sourceLine = null;

      const lineMatch = line.match(/at lines? (\d+)/);
      if (lineMatch) {
        sourceLine = parseInt(lineMatch[1], 10);
      }

      entries.push({ type: 'badbox', message, line: sourceLine, raw: line });
    }
  }

  return entries;
}

/**
 * Count entries by type.
 * @param {LogEntry[]} entries
 * @returns {{ errors: number, warnings: number, badboxes: number }}
 */
export function countEntries(entries) {
  return {
    errors: entries.filter(e => e.type === 'error').length,
    warnings: entries.filter(e => e.type === 'warning').length,
    badboxes: entries.filter(e => e.type === 'badbox').length,
  };
}
```

### Key Design Decisions

#### Why regex-based parsing?
- LaTeX logs don't have a structured format (no JSON, no XML)
- Regex is the standard approach — Overleaf, TeXstudio, and VS Code LaTeX Workshop all use it
- The patterns are well-established and stable across TeX distributions

#### Why look-ahead for error line numbers?
- LaTeX errors print the error on one line (`! Undefined control sequence.`) and the line number on the next (`l.42 \undefcommand`). We need to scan ahead 1-5 lines to find it.

#### Why include `raw`?
- The parsed `message` is a clean summary for display
- The `raw` text preserves the full log context for a "details" view or tooltip

### Definition of Done — Parser
- [ ] `parseLatexLog()` extracts errors, warnings, and badboxes
- [ ] Each entry has `type`, `message`, `line` (nullable), `raw`
- [ ] `countEntries()` returns correct counts
- [ ] Works with real LaTeX log output (test with actual compilation logs)

---

## Step 2: Create the Log Panel UI Module

### File: `src/js/logPanel.js`

```javascript
// src/js/logPanel.js
import { parseLatexLog, countEntries } from './logParser.js';
import { getEditorView } from './editor.js';

let panelEl = null;
let listEl = null;
let isOpen = false;
let currentEntries = [];

/**
 * Initialize the log panel.
 */
export function initLogPanel() {
  panelEl = document.getElementById('log-panel');
  listEl = document.getElementById('log-entries');

  // Toggle button
  document.getElementById('btn-logs').addEventListener('click', togglePanel);

  // Listen for compile events
  document.addEventListener('compile-success', (e) => {
    updateFromLog(e.detail.log || '');
  });
  document.addEventListener('compile-error', (e) => {
    updateFromLog(e.detail.log || '');
    // Auto-open on errors
    if (!isOpen) togglePanel();
  });

  console.log('Log panel initialized');
}

/**
 * Parse the log and update the panel + badge.
 */
function updateFromLog(logText) {
  currentEntries = parseLatexLog(logText);
  const counts = countEntries(currentEntries);

  // Update badge
  updateBadge(counts);

  // Render entries
  renderEntries(currentEntries);
}

/**
 * Render log entries into the panel.
 */
function renderEntries(entries) {
  listEl.innerHTML = '';

  if (entries.length === 0) {
    listEl.innerHTML = '<p class="log-empty">No errors or warnings ✓</p>';
    return;
  }

  entries.forEach((entry, index) => {
    const el = document.createElement('div');
    el.className = `log-entry log-${entry.type}`;
    el.dataset.index = index;

    // Icon based on type
    const icon = entry.type === 'error' ? '✗' : entry.type === 'warning' ? '⚠' : '▪';

    // Line number display
    const lineText = entry.line ? `l.${entry.line}` : '';

    el.innerHTML = `
      <span class="log-icon">${icon}</span>
      <span class="log-line">${lineText}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
    `;

    // Click handler → jump to line in editor (Feature 3.6)
    if (entry.line) {
      el.classList.add('log-clickable');
      el.addEventListener('click', () => goToLine(entry.line));
    }

    listEl.appendChild(el);
  });
}

/**
 * Navigate editor to a specific line (Feature 3.6).
 */
function goToLine(lineNum) {
  const view = getEditorView();
  if (!view) return;

  const totalLines = view.state.doc.lines;
  const target = Math.min(lineNum, totalLines);
  const line = view.state.doc.line(target);

  view.dispatch({
    selection: { anchor: line.from },
    scrollIntoView: true,
  });

  view.focus();
  console.log(`Log panel: jumped to line ${target}`);
}

/**
 * Update the badge on the Logs button (Feature 3.7).
 */
function updateBadge(counts) {
  const badge = document.getElementById('logs-badge');
  if (!badge) return;

  if (counts.errors === 0 && counts.warnings === 0) {
    badge.style.display = 'none';
    badge.textContent = '';
    return;
  }

  let text = '';
  if (counts.errors > 0) text += `${counts.errors} ✗`;
  if (counts.warnings > 0) text += `${text ? ' ' : ''}${counts.warnings} ⚠`;

  badge.textContent = text;
  badge.style.display = 'inline';
  badge.className = counts.errors > 0 ? 'badge badge-error' : 'badge badge-warning';
}

/**
 * Toggle the log panel open/closed.
 */
function togglePanel() {
  isOpen = !isOpen;
  panelEl.style.display = isOpen ? 'block' : 'none';
  document.getElementById('btn-logs').classList.toggle('btn-active', isOpen);
}

/**
 * Utility: escape HTML in log messages.
 */
function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
```

---

## Step 3: HTML for Log Panel & Toolbar

### Log Panel HTML
Add inside `#editor-panel`, below the `#editor-container`:
```html
<div id="log-panel" class="log-panel" style="display: none;">
  <div class="log-header">
    <span class="log-title">Compilation Log</span>
    <button id="log-panel-close" class="btn btn-ghost btn-sm">✕</button>
  </div>
  <div id="log-entries" class="log-entries">
    <p class="log-empty">No errors or warnings ✓</p>
  </div>
</div>
```

### Toolbar Button HTML
```html
<button id="btn-logs" class="btn btn-toolbar" title="Show compilation log">
  <span class="btn-icon">📋</span>
  <span class="btn-text">Logs</span>
  <span id="logs-badge" class="badge" style="display: none;"></span>
</button>
```

---

## Step 4: CSS for Log Panel, Entries, & Badge

```css
/* Log Panel */
.log-panel {
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  max-height: 200px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
}

.log-title {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* Log entries */
.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background var(--transition-fast);
}

.log-entry:last-child { border-bottom: none; }

.log-clickable { cursor: pointer; }
.log-clickable:hover { background: var(--bg-tertiary); }

.log-icon { flex-shrink: 0; width: 16px; text-align: center; }
.log-line {
  flex-shrink: 0;
  width: 40px;
  color: var(--text-placeholder);
}

.log-message {
  color: var(--text-primary);
  word-break: break-word;
}

/* Entry type colors */
.log-error .log-icon { color: var(--accent-error); }
.log-error .log-message { color: var(--accent-error); }
.log-warning .log-icon { color: var(--accent-warning); }
.log-badbox .log-icon { color: var(--text-placeholder); }
.log-badbox .log-message { color: var(--text-secondary); }

.log-empty {
  color: var(--accent-success);
  padding: 12px 10px;
  text-align: center;
}

/* Badge */
.badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  margin-left: 4px;
  font-weight: 700;
}
.badge-error { background: var(--accent-error); color: white; }
.badge-warning { background: var(--accent-warning); color: #1a1a2e; }
```

---

## Step 5: Modify Compile Events

The compile response from Phase 1 already includes `log`. Update `compiler.js` to pass it through the events:

```javascript
// In compiler.js runCompile(), update the compile-error event:
document.dispatchEvent(new CustomEvent('compile-error', {
  detail: { error: result.error, log: result.log },  // ← ensure log is included
}));

// And compile-success:
document.dispatchEvent(new CustomEvent('compile-success', {
  detail: { pdfUrl: result.pdfUrl, duration: result.duration, log: result.log },
}));
```

---

## Edge Cases

### 6.1 — No errors
Panel shows "No errors or warnings ✓" in green. Badge is hidden.

### 6.2 — Error without line number
Some errors (e.g., "File not found") don't have a line number. The entry shows but without `l.XX` and without a click handler. Not clickable.

### 6.3 — Many errors
If compilation produces 50+ errors (cascading), all are shown. The panel scrolls. Consider adding a "showing first 50" limit later.

### 6.4 — Preamble errors
Errors in the preamble (before `\begin{document}`) have line numbers relative to the preamble. These work normally — line 5 means line 5 of the file.

### 6.5 — Auto-open on error
When compilation fails, the log panel auto-opens (if it was closed). This ensures the user sees the error immediately.

### 6.6 — Successive successful compiles
Each compile replaces the previous entries. The panel updates, badge clears, entries refresh.

---

## Final Acceptance Checklist — Features 3.5, 3.6, 3.7

| # | Check | Status |
|---|-------|--------|
| 1 | `logParser.js` exists and extracts errors from real LaTeX logs | ☐ |
| 2 | `logParser.js` extracts warnings with line numbers | ☐ |
| 3 | `logParser.js` extracts overfull/underfull box messages | ☐ |
| 4 | Log panel appears below the editor when "Logs" is clicked | ☐ |
| 5 | Errors show in red with ✗ icon | ☐ |
| 6 | Warnings show in yellow with ⚠ icon | ☐ |
| 7 | Badboxes show in gray with ▪ icon | ☐ |
| 8 | "No errors or warnings ✓" shows when log is clean | ☐ |
| 9 | Clicking an error with line number → editor jumps to that line | ☐ |
| 10 | Entries without line numbers are NOT clickable | ☐ |
| 11 | Badge shows "2 ✗ 3 ⚠" format on the Logs button | ☐ |
| 12 | Badge is hidden when no errors/warnings | ☐ |
| 13 | Badge is red when errors exist, yellow when only warnings | ☐ |
| 14 | Panel auto-opens on compilation failure | ☐ |
| 15 | Panel can be toggled closed | ☐ |
| 16 | Successive compiles update the entries (don't append) | ☐ |

> **Done → Proceed to Features 3.8–3.9 (SyncTeX).**

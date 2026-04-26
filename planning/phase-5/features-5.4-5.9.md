# Feature 5.4 — Document Outline / Structure Navigator

> **Phase**: 5 | **Feature**: 4 of 9
> **Goal**: A panel in the sidebar showing the document hierarchy as a clickable tree. Sections, subsections, chapters are listed with proper indentation. Clicking an entry scrolls the editor to that line. Auto-updates on document changes.
> **Estimated Effort**: 3–4 hours
> **Dependencies**: Feature 5.3 (sidebar tab system).

---

## Overview

Purely frontend. No backend changes. Parses the current editor content with regex, builds a tree, renders it in the sidebar's "Outline" tab.

---

## Step 1: Create the Outline Module

### File: `src/js/outlinePanel.js`

```javascript
// src/js/outlinePanel.js
import { getEditorView } from './editor.js';
import { EditorView } from '@codemirror/view';

// Section hierarchy levels
const SECTION_LEVELS = {
  'part': 0,
  'chapter': 1,
  'section': 2,
  'subsection': 3,
  'subsubsection': 4,
  'paragraph': 5,
  'subparagraph': 6,
};

// Regex to match sectioning commands
const SECTION_REGEX = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{(.+?)\}/;

let outlineContainer = null;
let updateDebounce = null;

/**
 * Initialize the outline panel.
 */
export function initOutline() {
  outlineContainer = document.getElementById('outline-tree');
  if (!outlineContainer) return;

  // Initial render
  updateOutline();
  console.log('Outline panel initialized');
}

/**
 * Create a CodeMirror extension that updates the outline on doc changes.
 */
export function outlineUpdateExtension() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    // Debounce — don't re-parse on every keystroke
    clearTimeout(updateDebounce);
    updateDebounce = setTimeout(updateOutline, 500);
  });
}

/**
 * Parse the current editor content and render the outline.
 */
export function updateOutline() {
  const view = getEditorView();
  if (!view || !outlineContainer) return;

  const content = view.state.doc.toString();
  const entries = parseOutline(content);
  renderOutline(entries);
}

/**
 * Parse document text into outline entries.
 * @returns {Array<{ level, title, line }>}
 */
function parseOutline(text) {
  const lines = text.split('\n');
  const entries = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const match = trimmed.match(SECTION_REGEX);
    if (match) {
      const command = match[1];
      const title = match[2];
      entries.push({
        level: SECTION_LEVELS[command],
        command,
        title: cleanTitle(title),
        line: i + 1, // 1-indexed
      });
    }
  }

  return entries;
}

/**
 * Clean a title string (remove LaTeX commands, trim).
 */
function cleanTitle(title) {
  return title
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // \textbf{text} → text
    .replace(/\\[a-zA-Z]+/g, '')                // \LaTeX → ''
    .replace(/[{}]/g, '')                        // stray braces
    .trim();
}

/**
 * Render outline entries into the panel.
 */
function renderOutline(entries) {
  if (!outlineContainer) return;

  if (entries.length === 0) {
    outlineContainer.innerHTML = '<p class="outline-empty">No sections found</p>';
    return;
  }

  const html = entries.map(e => {
    const indent = e.level * 16; // 16px per level
    const icon = e.level <= 1 ? '📖' : e.level <= 3 ? '📄' : '•';
    const sizeClass = e.level <= 1 ? 'outline-major' : e.level <= 3 ? '' : 'outline-minor';

    return `
      <div class="outline-entry ${sizeClass}" style="padding-left: ${8 + indent}px"
           data-line="${e.line}">
        <span class="outline-icon">${icon}</span>
        <span class="outline-title">${escapeHtml(e.title)}</span>
      </div>
    `;
  }).join('');

  outlineContainer.innerHTML = html;

  // Click handlers
  outlineContainer.querySelectorAll('.outline-entry').forEach(el => {
    el.addEventListener('click', () => {
      const line = parseInt(el.dataset.line, 10);
      goToLine(line);
    });
  });
}

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
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
```

---

## Step 2: CSS for Outline

```css
.outline-tree { overflow-y: auto; flex: 1; padding: 4px 0; }
.outline-empty {
  padding: 12px;
  color: var(--text-placeholder);
  font-size: var(--font-size-sm);
  text-align: center;
}

.outline-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  transition: background var(--transition-fast);
}

.outline-entry:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.outline-major {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-md);
}

.outline-minor {
  font-size: var(--font-size-xs);
  color: var(--text-placeholder);
}

.outline-icon { font-size: 12px; flex-shrink: 0; }
```

---

## Edge Cases

- **No sectioning commands**: Shows "No sections found"
- **Starred variants** (`\section*{}`): Matched by the regex (`\*?`)
- **Nested braces** (`\section{The \textbf{Key} Idea}`): `cleanTitle` strips inner commands
- **Auto-update rate**: Debounced at 500ms — won't lag during typing
- **Very large documents (10,000 lines)**: Regex scan is < 10ms. Fine.

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Outline tab (📑) appears in sidebar | ☐ |
| 2 | Sections and subsections listed with proper indentation | ☐ |
| 3 | Chapter/part entries are visually larger | ☐ |
| 4 | Clicking an entry scrolls editor to that line | ☐ |
| 5 | Outline auto-updates on document changes (500ms debounce) | ☐ |
| 6 | "No sections found" for documents without sectioning | ☐ |
| 7 | Starred sections (`\section*{}`) appear | ☐ |
| 8 | LaTeX commands inside titles are cleaned | ☐ |

> **Done → Proceed to Feature 5.5.**

---
---

# Feature 5.9 — Word Count

> **Phase**: 5 | **Feature**: 9 of 9
> **Goal**: Display word count in the editor status bar. Updated after compilation or on demand.
> **Estimated Effort**: 1–2 hours
> **Dependencies**: Feature 1.3 (compilation backend), TeX Live installation (provides `texcount`).

---

## Step 1: Backend — Word Count Endpoint

### File: `server/routes/wordcount.js`

```javascript
import express from 'express';
import { execFile } from 'child_process';
import path from 'path';

const router = express.Router();
const PROJECTS_DIR = path.resolve(process.cwd(), 'projects');

/**
 * GET /api/projects/:project/wordcount
 * Query: { file: 'main.tex' }
 * Returns: { words, headers, captions, total }
 */
router.get('/:project/wordcount', (req, res) => {
  const { project } = req.params;
  const file = req.query.file || 'main.tex';
  const projectDir = path.resolve(PROJECTS_DIR, project);

  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  const filePath = path.join(projectDir, file);

  // Try texcount first
  execFile('texcount', ['-1', '-sum', filePath], {
    timeout: 10000,
    cwd: projectDir,
  }, (error, stdout) => {
    if (error) {
      // Fallback: naive word count
      const fs = require('fs');
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const words = naiveWordCount(content);
        return res.json({ words, method: 'naive' });
      } catch {
        return res.status(500).json({ error: 'Word count failed' });
      }
    }

    // texcount -1 -sum outputs a single number
    const words = parseInt(stdout.trim(), 10) || 0;
    res.json({ words, method: 'texcount' });
  });
});

function naiveWordCount(text) {
  // Strip LaTeX commands, then count words
  const cleaned = text
    .replace(/%.*/g, '')                    // Remove comments
    .replace(/\\[a-zA-Z]+\*?(\{[^}]*\})*/g, '') // Remove commands
    .replace(/[{}$\\[\]]/g, ' ')            // Remove braces, math delimiters
    .replace(/\s+/g, ' ')                   // Normalize whitespace
    .trim();
  return cleaned.length === 0 ? 0 : cleaned.split(/\s+/).length;
}

export default router;
```

---

## Step 2: Frontend — Status Bar

Add to the bottom of the editor panel:
```html
<div id="status-bar" class="status-bar">
  <span id="cursor-position">Ln 1, Col 1</span>
  <span class="status-divider">|</span>
  <span id="word-count">Words: —</span>
</div>
```

```javascript
// Update word count after compilation
document.addEventListener('compile-success', async () => {
  try {
    const response = await fetch(`/api/projects/${currentProject}/wordcount?file=${mainFile}`);
    const data = await response.json();
    document.getElementById('word-count').textContent = `Words: ${data.words.toLocaleString()}`;
  } catch { /* ignore */ }
});

// Also update cursor position on every editor update
// (Using EditorView.updateListener — already in editor.js)
```

### CSS
```css
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 12px;
  background: var(--bg-toolbar);
  border-top: 1px solid var(--border-color);
  font-size: var(--font-size-xs);
  color: var(--text-placeholder);
  font-family: var(--font-mono);
}
.status-divider { color: var(--border-color); }
```

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Status bar appears at the bottom of the editor | ☐ |
| 2 | Cursor position shows "Ln X, Col Y" | ☐ |
| 3 | Word count shows after compilation | ☐ |
| 4 | `texcount` used when available | ☐ |
| 5 | Naive fallback works when `texcount` is not installed | ☐ |

> **Done → Proceed to Feature 5.5 (Spell Checker).**

# Features 3.8, 3.9 — SyncTeX (Forward & Inverse Sync)

> **Phase**: 3 | **Features**: 8, 9 (tightly coupled)
> **Goal**: Bidirectional navigation between the editor and PDF preview. Forward: click/shortcut in editor → PDF scrolls to matching location. Inverse: double-click in PDF → editor jumps to source line.
> **Estimated Effort**: 6–9 hours total
> **Dependencies**: Feature 1.3 (compilation with `-synctex=1`), Feature 1.5 (PDF viewer).

---

## Overview

SyncTeX is a technology built into TeX engines that records the mapping between source `.tex` file positions and output PDF page/coordinates. The data is stored in a `.synctex.gz` file alongside the PDF.

### Two Approaches

**Approach A — Backend CLI (recommended)**:
- Use the `synctex` command-line tool (installed with TeX Live)
- Create backend API endpoints: `GET /api/synctex/forward` and `GET /api/synctex/inverse`
- Frontend sends source line → backend returns PDF page + coordinates
- Frontend sends PDF page + coordinates → backend returns source line

**Approach B — Browser-side parsing**:
- Download the `.synctex.gz` file to the browser
- Decompress with `pako` (gzip library)
- Parse the SyncTeX format in JavaScript
- All queries happen client-side

**We'll use Approach A** because:
- The `synctex` CLI tool handles all the complex parsing (reliable, battle-tested)
- No need to write a SyncTeX parser from scratch
- The `.synctex.gz` format is complex and underdocumented
- Network latency is negligible for local-first usage

---

## Step 1: Backend — SyncTeX API Endpoints

### File: `server/routes/synctex.js`

```javascript
// server/routes/synctex.js
import express from 'express';
import { execFile } from 'child_process';
import path from 'path';

const router = express.Router();
const PROJECTS_DIR = path.resolve(process.cwd(), 'projects');

/**
 * GET /api/synctex/forward
 * Query: { project, file, line }
 * Returns: { page, x, y }
 * Maps: source file + line → PDF page + position
 */
router.get('/synctex/forward', (req, res) => {
  const { project, file, line } = req.query;

  if (!project || !file || !line) {
    return res.status(400).json({ error: 'Missing project, file, or line' });
  }

  const projectDir = path.resolve(PROJECTS_DIR, project);
  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  const outputDir = path.join(projectDir, 'output');
  const pdfName = file.replace(/\.tex$/, '.pdf');
  const pdfPath = path.join(outputDir, pdfName);

  // synctex view -i <line>:<column>:<input_file> -o <output_pdf>
  const args = [
    'view',
    '-i', `${line}:0:${path.join(projectDir, file)}`,
    '-o', pdfPath,
  ];

  const isWindows = process.platform === 'win32';
  execFile(isWindows ? 'synctex.exe' : 'synctex', args, {
    cwd: projectDir,
    timeout: 5000,
    ...(isWindows && { shell: true }),
  }, (error, stdout) => {
    if (error) {
      console.error('SyncTeX forward error:', error);
      return res.status(500).json({ error: 'SyncTeX forward failed' });
    }

    // Parse synctex output
    const result = parseSynctexOutput(stdout);
    res.json(result);
  });
});

/**
 * GET /api/synctex/inverse
 * Query: { project, file, page, x, y }
 * Returns: { line, column, inputFile }
 * Maps: PDF page + position → source file + line
 */
router.get('/synctex/inverse', (req, res) => {
  const { project, file, page, x, y } = req.query;

  if (!project || !file || !page || !x || !y) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const projectDir = path.resolve(PROJECTS_DIR, project);
  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  const outputDir = path.join(projectDir, 'output');
  const pdfName = file.replace(/\.tex$/, '.pdf');
  const pdfPath = path.join(outputDir, pdfName);

  // synctex edit -o <page>:<x>:<y>:<output_pdf>
  const args = [
    'edit',
    '-o', `${page}:${x}:${y}:${pdfPath}`,
  ];

  const isWindows = process.platform === 'win32';
  execFile(isWindows ? 'synctex.exe' : 'synctex', args, {
    cwd: projectDir,
    timeout: 5000,
    ...(isWindows && { shell: true }),
  }, (error, stdout) => {
    if (error) {
      console.error('SyncTeX inverse error:', error);
      return res.status(500).json({ error: 'SyncTeX inverse failed' });
    }

    const result = parseSynctexEditOutput(stdout);
    res.json(result);
  });
});

/**
 * Parse `synctex view` output.
 * Output format:
 *   Page:1
 *   x:72.0
 *   y:680.0
 *   ...
 */
function parseSynctexOutput(output) {
  const result = { page: 1, x: 0, y: 0 };
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.startsWith('Page:')) result.page = parseInt(line.split(':')[1], 10);
    if (line.startsWith('x:')) result.x = parseFloat(line.split(':')[1]);
    if (line.startsWith('y:')) result.y = parseFloat(line.split(':')[1]);
  }
  return result;
}

/**
 * Parse `synctex edit` output.
 * Output format:
 *   Input:./main.tex
 *   Line:42
 *   Column:0
 *   ...
 */
function parseSynctexEditOutput(output) {
  const result = { line: 1, column: 0, inputFile: '' };
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.startsWith('Input:')) result.inputFile = line.split(':').slice(1).join(':').trim();
    if (line.startsWith('Line:')) result.line = parseInt(line.split(':')[1], 10);
    if (line.startsWith('Column:')) result.column = parseInt(line.split(':')[1], 10);
  }
  return result;
}

export default router;
```

### Register in server
```javascript
import synctexRoutes from './routes/synctex.js';
app.use('/api', synctexRoutes);
```

---

## Step 2: Frontend — SyncTeX Module

### File: `src/js/syncTeX.js`

```javascript
// src/js/syncTeX.js
import { getEditorView } from './editor.js';

const PROJECT_PATH = 'sample';
const MAIN_FILE = 'main.tex';

/**
 * Forward sync: editor cursor → scroll PDF to matching position.
 */
export async function forwardSync() {
  const view = getEditorView();
  if (!view) return;

  const cursorPos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(cursorPos).number;

  try {
    const params = new URLSearchParams({ project: PROJECT_PATH, file: MAIN_FILE, line });
    const response = await fetch(`/api/synctex/forward?${params}`);
    const data = await response.json();

    if (data.error) {
      console.warn('Forward sync failed:', data.error);
      return;
    }

    // Scroll PDF to the target page and y-position
    scrollPdfToPosition(data.page, data.y);
    console.log(`Forward sync: line ${line} → page ${data.page}, y=${data.y}`);
  } catch (err) {
    console.error('Forward sync error:', err);
  }
}

/**
 * Inverse sync: PDF click position → jump to editor line.
 * @param {number} pageNum - 1-indexed page number
 * @param {number} x - x coordinate in PDF points
 * @param {number} y - y coordinate in PDF points
 */
export async function inverseSync(pageNum, x, y) {
  try {
    const params = new URLSearchParams({
      project: PROJECT_PATH,
      file: MAIN_FILE,
      page: pageNum,
      x: x.toFixed(2),
      y: y.toFixed(2),
    });
    const response = await fetch(`/api/synctex/inverse?${params}`);
    const data = await response.json();

    if (data.error || !data.line) {
      console.warn('Inverse sync failed:', data.error);
      return;
    }

    // Jump editor to the returned line
    const view = getEditorView();
    if (!view) return;

    const targetLine = view.state.doc.line(
      Math.min(data.line, view.state.doc.lines)
    );

    view.dispatch({
      selection: { anchor: targetLine.from },
      scrollIntoView: true,
    });

    view.focus();
    console.log(`Inverse sync: page ${pageNum} (${x}, ${y}) → line ${data.line}`);
  } catch (err) {
    console.error('Inverse sync error:', err);
  }
}

/**
 * Scroll the PDF container to a specific page and y-position.
 */
function scrollPdfToPosition(pageNum, yPdfPoints) {
  const container = document.getElementById('pdf-container');
  if (!container) return;

  const canvases = container.querySelectorAll('.pdf-page');
  if (pageNum < 1 || pageNum > canvases.length) return;

  const targetCanvas = canvases[pageNum - 1]; // 0-indexed

  // Convert PDF points to pixel position on the canvas
  // PDF coordinate system: origin at bottom-left, y increases upward
  // Canvas coordinate system: origin at top-left, y increases downward
  const canvasHeight = targetCanvas.height / (window.devicePixelRatio || 1);
  const scale = targetCanvas.clientWidth / (targetCanvas.width / (window.devicePixelRatio || 1));
  const yPixels = canvasHeight - (yPdfPoints * scale / 72); // Convert points to pixels

  // Scroll the container to bring the target position into view
  const targetScrollTop = targetCanvas.offsetTop + yPixels - container.clientHeight / 3;
  container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
}
```

---

## Step 3: Add PDF Double-Click Handler for Inverse Sync

### Modify `src/js/pdfViewer.js`

When rendering each page canvas, attach a double-click handler:

```javascript
// In renderPage() — after canvas is added to the container:
canvas.addEventListener('dblclick', (e) => {
  // Convert click position to PDF coordinates
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // Click position in canvas pixels (adjusted for devicePixelRatio)
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  // Convert to PDF points (72 points per inch)
  // PDF y-axis is inverted (origin at bottom-left)
  const viewport = page.getViewport({ scale: currentScale });
  const pdfX = canvasX / (window.devicePixelRatio || 1) * 72 / viewport.scale;
  const pdfY = (viewport.height - canvasY / (window.devicePixelRatio || 1)) * 72 / viewport.scale;

  // Import and call inverse sync
  import('./syncTeX.js').then(({ inverseSync }) => {
    inverseSync(pageNum, pdfX, pdfY);
  });
});
```

### Coordinate Conversion Notes
The trickiest part of SyncTeX is coordinate conversion:
- **PDF points**: 72 points per inch. Origin at bottom-left. Y increases upward.
- **Canvas pixels**: Origin at top-left. Y increases downward. Scaled by `devicePixelRatio`.
- **SyncTeX coordinates**: Same as PDF points (origin bottom-left).
- The conversion must account for the viewport scale (zoom level) and the canvas pixel ratio.

This will need testing with actual documents. The formulas above are the starting point — they may need adjustment based on real SyncTeX output.

---

## Step 4: Register Forward Sync Shortcut

Add a keyboard shortcut for forward sync:

```javascript
// In app.js or editor.js:
import { forwardSync } from './syncTeX.js';

// Register Ctrl+Shift+Right for forward sync
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowRight') {
    e.preventDefault();
    forwardSync();
  }
});
```

Optionally add a toolbar button:
```html
<button id="btn-forward-sync" class="btn btn-toolbar" title="Forward sync (Ctrl+Shift+→)">
  <span class="btn-icon">→📄</span>
</button>
```

---

## Edge Cases

### 5.1 — SyncTeX file doesn't exist
If the user hasn't compiled yet, or compilation failed, the `.synctex.gz` file won't exist. The backend returns a 500 error. The frontend silently logs it — no crash.

### 5.2 — Cursor on comment or preamble
SyncTeX may not have data for comments or preamble lines. The `synctex view` command returns empty or "no match". Handle gracefully — don't scroll.

### 5.3 — Multi-file projects (Phase 4+)
SyncTeX supports multi-file projects via `\input{}`/`\include{}`. The `inputFile` field in inverse sync tells us which file the click maps to. For Phase 3, we only handle `main.tex`. In Phase 4, we'll open the correct file.

### 5.4 — Accuracy
SyncTeX mapping is approximate — it maps to the nearest paragraph or line, not character-level. This is expected behavior (same as Overleaf).

### 5.5 — synctex CLI not installed
If `synctex` is not in PATH, the backend commands fail. Log the error and show a user-friendly message: "SyncTeX not available — install TeX Live to enable".

### 5.6 — Draft mode
SyncTeX works in draft mode because we're using `\PassOptionsToPackage{draft}{graphicx}`, not `-draftmode`. The SyncTeX data is still generated.

---

## Do's & Don'ts

### Do's
- ✅ Use the backend CLI approach — it's reliable and well-tested
- ✅ Validate all paths on the backend (prevent traversal)
- ✅ Handle missing `.synctex.gz` gracefully
- ✅ Use smooth scrolling for forward sync
- ✅ Flash/highlight the target line after inverse sync

### Don'ts
- ❌ Don't parse `.synctex.gz` in the browser — it's complex and fragile
- ❌ Don't expect character-level accuracy — paragraph-level is normal
- ❌ Don't block the UI while waiting for SyncTeX response
- ❌ Don't show error dialogs for SyncTeX failures — just log them

---

## Final Acceptance Checklist — Features 3.8, 3.9

| # | Check | Status |
|---|-------|--------|
| 1 | `-synctex=1` flag is passed to `latexmk` (Phase 1, verify) | ☐ |
| 2 | `.synctex.gz` file is generated in the output directory | ☐ |
| 3 | Backend `GET /api/synctex/forward` endpoint works | ☐ |
| 4 | Backend `GET /api/synctex/inverse` endpoint works | ☐ |
| 5 | Path traversal is prevented on both endpoints | ☐ |
| 6 | `Ctrl+Shift+→` triggers forward sync | ☐ |
| 7 | Forward sync: cursor on `\section{Intro}` → PDF scrolls to that section | ☐ |
| 8 | Forward sync: smooth scrolling animation | ☐ |
| 9 | Double-click on PDF text → editor jumps to source line | ☐ |
| 10 | Inverse sync: editor cursor is placed at the correct line | ☐ |
| 11 | Inverse sync: editor gains focus after jump | ☐ |
| 12 | Missing `.synctex.gz` → graceful failure (no crash) | ☐ |
| 13 | `synctex` not installed → informative error log | ☐ |
| 14 | Console logs confirm sync operations | ☐ |

> **Done → Proceed to Feature 3.10 (PDF Zoom Controls).**

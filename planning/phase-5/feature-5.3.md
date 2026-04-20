# Feature 5.3 — Project-Wide Search (Find in All Files)

> **Phase**: 5 | **Feature**: 3 of 9
> **Goal**: `Ctrl+Shift+F` opens a search panel in the sidebar that scans all text files across the project. Shows results with file name, line number, and context snippet. Each result is clickable — opens the file and jumps to the line.
> **Estimated Effort**: 4–6 hours
> **Dependencies**: Feature 4.3 (file tree sidebar — we reuse the tabbed sidebar pattern).

---

## Overview

Two components:
1. **Backend**: `GET /api/projects/:name/search?q=<query>` — scans text files recursively
2. **Frontend**: Search tab in the sidebar with input, results list, and click-to-navigate

---

## Step 1: Backend — Search Endpoint

### File: `server/routes/search.js`

```javascript
// server/routes/search.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const PROJECTS_DIR = path.resolve(process.cwd(), 'projects');

// Text file extensions we search in
const SEARCHABLE_EXTS = new Set([
  '.tex', '.bib', '.sty', '.cls', '.txt', '.md', '.csv', '.bst',
  '.dtx', '.ins', '.ltx', '.tikz', '.py', '.js', '.json', '.cfg',
]);

const MAX_RESULTS = 200;

/**
 * GET /api/projects/:project/search
 * Query: { q: string, caseSensitive?: boolean, regex?: boolean }
 * Returns: { results: [{ file, line, column, context, matchLength }] }
 */
router.get('/:project/search', async (req, res) => {
  const { project } = req.params;
  const { q, caseSensitive, regex } = req.query;

  if (!q || q.trim().length === 0) {
    return res.json({ results: [] });
  }

  const projectDir = path.resolve(PROJECTS_DIR, project);
  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    const results = [];
    await searchDirectory(projectDir, projectDir, q, {
      caseSensitive: caseSensitive === 'true',
      regex: regex === 'true',
    }, results);

    res.json({ results: results.slice(0, MAX_RESULTS), total: results.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Recursively search all text files in a directory.
 */
async function searchDirectory(baseDir, currentDir, query, options, results) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden and excluded directories
    if (entry.name.startsWith('.') || entry.name === 'output' || entry.name === 'node_modules') {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await searchDirectory(baseDir, fullPath, query, options, results);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SEARCHABLE_EXTS.has(ext)) continue;

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        searchInFile(content, relativePath, query, options, results);
      } catch { /* skip unreadable files */ }
    }

    // Early exit if we have enough results
    if (results.length >= MAX_RESULTS * 2) return;
  }
}

/**
 * Search for query matches in a single file's content.
 */
function searchInFile(content, filePath, query, options, results) {
  const lines = content.split('\n');
  let pattern;

  try {
    if (options.regex) {
      pattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, options.caseSensitive ? 'g' : 'gi');
    }
  } catch {
    // Invalid regex — treat as literal
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(escaped, options.caseSensitive ? 'g' : 'gi');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    pattern.lastIndex = 0; // Reset for each line

    while ((match = pattern.exec(line)) !== null) {
      results.push({
        file: filePath,
        line: i + 1,       // 1-indexed
        column: match.index,
        context: line.trim().substring(0, 200), // Max 200 chars of context
        matchLength: match[0].length,
      });

      if (results.length >= MAX_RESULTS * 2) return;
    }
  }
}

export default router;
```

### Key Design Decisions
- **Node.js search, not `grep`**: We use pure Node.js file reading so it works identically on Windows, Mac, and Linux. No dependency on system `grep`.
- **Searchable extensions whitelist**: Only search in text files. Skip `.png`, `.pdf`, etc.
- **Max 200 results**: Prevents UI overwhelm and server strain on huge projects.
- **Regex support**: User can toggle regex mode. Invalid regex is silently treated as literal.
- **Case sensitivity**: Toggle via query param.

---

## Step 2: Frontend — Search Panel

### Sidebar Tab System
Convert the existing file sidebar from a single panel to a tabbed panel:

```html
<!-- Inside #file-sidebar -->
<div class="sidebar-tabs">
  <button class="sidebar-tab active" data-panel="files" title="Files">📁</button>
  <button class="sidebar-tab" data-panel="search" title="Search">🔍</button>
  <button class="sidebar-tab" data-panel="outline" title="Outline">📑</button>
</div>

<!-- File tree panel (existing) -->
<div id="panel-files" class="sidebar-panel active">
  <div id="file-tree" class="file-tree"></div>
</div>

<!-- Search panel (new) -->
<div id="panel-search" class="sidebar-panel" style="display: none;">
  <div class="search-header">
    <input id="search-input" class="search-input" type="text"
           placeholder="Search in project..." />
    <div class="search-options">
      <label><input type="checkbox" id="search-case" /> Aa</label>
      <label><input type="checkbox" id="search-regex" /> .*</label>
    </div>
  </div>
  <div id="search-results" class="search-results">
    <p class="search-empty">Type to search across all files</p>
  </div>
</div>

<!-- Outline panel (Feature 5.4 — placeholder for now) -->
<div id="panel-outline" class="sidebar-panel" style="display: none;">
  <div id="outline-tree" class="outline-tree"></div>
</div>
```

### Tab Switching Logic
```javascript
// Sidebar tab switching
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach(p => { p.style.display = 'none'; });
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.panel}`).style.display = 'block';
  });
});

// Ctrl+Shift+F → switch to search tab + focus input
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    document.querySelector('[data-panel="search"]').click();
    document.getElementById('search-input').focus();
  }
});
```

### Search Execution
```javascript
let searchDebounce = null;

document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(executeSearch, 300); // 300ms debounce
});

async function executeSearch() {
  const query = document.getElementById('search-input').value.trim();
  const container = document.getElementById('search-results');

  if (!query) {
    container.innerHTML = '<p class="search-empty">Type to search across all files</p>';
    return;
  }

  const caseSensitive = document.getElementById('search-case').checked;
  const regex = document.getElementById('search-regex').checked;

  try {
    const params = new URLSearchParams({ q: query, caseSensitive, regex });
    const response = await fetch(`/api/projects/${currentProject}/search?${params}`);
    const data = await response.json();

    renderSearchResults(data.results, data.total, query);
  } catch (err) {
    container.innerHTML = '<p class="search-empty">Search failed</p>';
  }
}

function renderSearchResults(results, total, query) {
  const container = document.getElementById('search-results');

  if (results.length === 0) {
    container.innerHTML = '<p class="search-empty">No results found</p>';
    return;
  }

  // Group results by file
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.file]) grouped[r.file] = [];
    grouped[r.file].push(r);
  }

  let html = '';
  if (total > results.length) {
    html += `<p class="search-info">Showing ${results.length} of ${total} results</p>`;
  }

  for (const [file, matches] of Object.entries(grouped)) {
    html += `<div class="search-file-group">`;
    html += `<div class="search-file-name">${file} (${matches.length})</div>`;
    for (const m of matches) {
      // Highlight the match in the context
      const highlighted = highlightMatch(m.context, query);
      html += `
        <div class="search-result" data-file="${m.file}" data-line="${m.line}">
          <span class="search-line-num">${m.line}</span>
          <span class="search-context">${highlighted}</span>
        </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // Click handlers
  container.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => {
      const file = el.dataset.file;
      const line = parseInt(el.dataset.line, 10);
      openFileAtLine(file, line); // Reuse from fileTree/logPanel
    });
  });
}
```

---

## Step 3: CSS for Search Panel

```css
/* Sidebar Tabs */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-toolbar);
}

.sidebar-tab {
  flex: 1;
  padding: 8px;
  text-align: center;
  background: transparent;
  border: none;
  color: var(--text-placeholder);
  cursor: pointer;
  font-size: 16px;
  transition: all var(--transition-fast);
  border-bottom: 2px solid transparent;
}

.sidebar-tab:hover { color: var(--text-primary); }
.sidebar-tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}

/* Search Panel */
.search-header {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.search-options {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.search-results { overflow-y: auto; flex: 1; }
.search-empty, .search-info {
  padding: 12px;
  color: var(--text-placeholder);
  font-size: var(--font-size-sm);
  text-align: center;
}

.search-file-group { margin-bottom: 4px; }
.search-file-name {
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--accent-primary);
  background: var(--bg-tertiary);
  position: sticky;
  top: 0;
}

.search-result {
  display: flex;
  gap: 8px;
  padding: 3px 12px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
  transition: background var(--transition-fast);
}

.search-result:hover { background: var(--bg-tertiary); }
.search-line-num {
  color: var(--text-placeholder);
  min-width: 30px;
  text-align: right;
  flex-shrink: 0;
}
.search-context { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-highlight { background: rgba(255, 214, 0, 0.3); color: var(--text-primary); font-weight: 600; }
```

---

## Edge Cases

### 4.1 — Huge project (10,000+ files)
The search could be slow. We cap at 200 results and skip binary files. For Phase 5, this is acceptable. Phase 7+ could add a background worker or use `ripgrep`.

### 4.2 — Invalid regex
If the user enables regex mode and types `[invalid`, the backend catches the error and falls back to literal search.

### 4.3 — Result in non-open file
Clicking a result for `chapter2.tex` should load that file in the editor (using the same `openFileAtLine` function from Feature 4.3).

### 4.4 — Search while typing
The 300ms debounce prevents firing a search on every keystroke. Only triggers after the user pauses.

### 4.5 — Empty project
Returns 0 results immediately. No error.

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | `Ctrl+Shift+F` switches to Search tab and focuses input | ☐ |
| 2 | Typing a query → results appear after 300ms debounce | ☐ |
| 3 | Results grouped by file with file name header | ☐ |
| 4 | Each result shows line number and context snippet | ☐ |
| 5 | Query text highlighted in results | ☐ |
| 6 | Clicking a result opens the file and jumps to the line | ☐ |
| 7 | Case-sensitivity toggle works | ☐ |
| 8 | Regex toggle works | ☐ |
| 9 | "No results found" when nothing matches | ☐ |
| 10 | Max 200 results shown (with "Showing X of Y" message) | ☐ |
| 11 | Binary files (`.png`, `.pdf`) are NOT searched | ☐ |
| 12 | `output/` directory is NOT searched | ☐ |

> **Done → Proceed to Feature 5.4.**

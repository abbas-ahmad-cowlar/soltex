# Feature 4.3 — File Tree Sidebar

> **Phase**: 4 | **Feature**: 3 of 11
> **Goal**: A hierarchical tree view in the left sidebar showing all files and folders in the current project. Click a file to open it in the editor. Folders are collapsible. Files show type-specific icons.
> **Estimated Effort**: 6–8 hours
> **Dependencies**: Feature 4.1 (project model), Feature 1.2 (editor for file loading).

---

## Overview

Three components:
1. **Backend**: `GET /api/projects/:name/files` — recursively list all files in a project
2. **Frontend**: `src/js/fileTree.js` — renders the tree, handles clicks, manages selection state
3. **CSS**: Tree styling, icons, hover effects, active file highlighting

### Data Flow
```
GET /api/projects/:name/files → tree JSON → fileTree.js renders → user clicks → loadFile() → editor updates
```

---

## Step 1: Backend — File Listing API

### Add to `server/routes/files.js`

```javascript
// server/routes/files.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const PROJECTS_DIR = path.resolve(process.cwd(), 'projects');

// Hidden/excluded items
const EXCLUDED = new Set(['output', 'project.json', '.git', 'node_modules', '_draft_wrapper.tex']);

/**
 * GET /api/projects/:project/files
 * Returns a recursive tree structure of the project.
 */
router.get('/:project/files', async (req, res) => {
  const { project } = req.params;
  const projectDir = path.resolve(PROJECTS_DIR, project);

  // Path traversal check
  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    const tree = await buildTree(projectDir, '');
    res.json({ tree });
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * Recursively build a tree structure.
 * @returns {Array<{ name, path, type, children? }>}
 */
async function buildTree(baseDir, relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const result = [];

  // Sort: folders first, then files, alphabetically
  const sorted = entries
    .filter(e => !EXCLUDED.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await buildTree(baseDir, entryPath);
      result.push({
        name: entry.name,
        path: entryPath,
        type: 'folder',
        children,
      });
    } else {
      result.push({
        name: entry.name,
        path: entryPath,
        type: 'file',
      });
    }
  }

  return result;
}

export default router;
```

### Key Points
- **Excludes `output/`, `project.json`, `.git`**: These are internal. The user shouldn't see them.
- **Sorts folders first**: Standard file explorer behavior.
- **Recursive**: Handles arbitrary nesting depth.
- **Returns relative paths**: e.g., `images/fig1.png`, not absolute paths.

---

## Step 2: Frontend — File Tree Component

### File: `src/js/fileTree.js`

```javascript
// src/js/fileTree.js

let treeContainer = null;
let currentProject = null;
let activeFile = null;   // Currently open file path
let onFileSelect = null; // Callback when a file is clicked

/**
 * Initialize the file tree.
 * @param {string} project - Project slug
 * @param {Function} onSelect - Callback: (filePath) => void
 */
export async function initFileTree(project, onSelect) {
  currentProject = project;
  onFileSelect = onSelect;
  treeContainer = document.getElementById('file-tree');

  if (!treeContainer) {
    console.error('File tree container not found');
    return;
  }

  await refreshTree();
  console.log(`File tree initialized for project: ${project}`);
}

/**
 * Refresh the tree from the server.
 */
export async function refreshTree() {
  try {
    const response = await fetch(`/api/projects/${currentProject}/files`);
    const data = await response.json();
    renderTree(data.tree);
  } catch (err) {
    console.error('Failed to load file tree:', err);
    treeContainer.innerHTML = '<p class="tree-error">Failed to load files</p>';
  }
}

/**
 * Render the tree into the container.
 */
function renderTree(items) {
  treeContainer.innerHTML = '';
  const ul = createTreeLevel(items, 0);
  treeContainer.appendChild(ul);
}

/**
 * Recursively create tree levels.
 */
function createTreeLevel(items, depth) {
  const ul = document.createElement('ul');
  ul.className = 'tree-level';
  ul.style.paddingLeft = depth === 0 ? '0' : '16px';

  for (const item of items) {
    const li = document.createElement('li');
    li.className = `tree-item tree-${item.type}`;

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.dataset.path = item.path;
    row.dataset.type = item.type;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = item.type === 'folder' ? '📁' : getFileIcon(item.name);

    // Name
    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = item.name;

    row.appendChild(icon);
    row.appendChild(name);

    // Click handlers
    if (item.type === 'folder') {
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = '▾';
      row.prepend(arrow);

      row.addEventListener('click', () => {
        li.classList.toggle('collapsed');
        arrow.textContent = li.classList.contains('collapsed') ? '▸' : '▾';
      });
    } else {
      row.addEventListener('click', () => {
        selectFile(item.path, row);
      });
    }

    li.appendChild(row);

    // Children (folders)
    if (item.type === 'folder' && item.children) {
      const childUl = createTreeLevel(item.children, depth + 1);
      li.appendChild(childUl);
    }

    ul.appendChild(li);
  }

  return ul;
}

/**
 * Handle file selection.
 */
function selectFile(filePath, rowEl) {
  // Deselect previous
  const prev = treeContainer.querySelector('.tree-row.active');
  if (prev) prev.classList.remove('active');

  // Select new
  rowEl.classList.add('active');
  activeFile = filePath;

  // Notify callback
  if (onFileSelect) onFileSelect(filePath);
}

/**
 * Get an emoji icon based on file extension.
 */
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    tex: '📝',
    bib: '📚',
    sty: '🎨',
    cls: '📋',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
    pdf: '📕',
    txt: '📄',
    md: '📝',
    csv: '📊',
    py: '🐍', js: '📜',
  };
  return icons[ext] || '📄';
}

/**
 * Set the active file externally (e.g., after loading a project).
 */
export function setActiveFile(filePath) {
  activeFile = filePath;
  const rows = treeContainer.querySelectorAll('.tree-row');
  rows.forEach(r => {
    r.classList.toggle('active', r.dataset.path === filePath);
  });
}
```

---

## Step 3: HTML — Add Sidebar to Editor Page

Modify `src/index.html` (now `src/editor.html`) to add the file tree sidebar:

```html
<!-- Add before #editor-panel -->
<aside id="file-sidebar" class="file-sidebar">
  <div class="sidebar-header">
    <span class="sidebar-title">Files</span>
    <button id="btn-toggle-sidebar" class="btn btn-icon-only btn-sm" title="Toggle sidebar">☰</button>
  </div>
  <div id="file-tree" class="file-tree">
    <!-- Populated by fileTree.js -->
  </div>
</aside>
```

The editor page layout now uses a 3-column CSS grid:
```css
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width, 200px) 1fr auto 1fr;
  grid-template-rows: auto 1fr;
  height: 100vh;
}
```

Where:
- Column 1: File sidebar (200px default, collapsible to 0)
- Column 2: Editor panel
- Column 3: Splitter (from Phase 1)
- Column 4: PDF preview

---

## Step 4: CSS for File Tree

```css
/* File Sidebar */
.file-sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  transition: width var(--transition-fast);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-toolbar);
}

.sidebar-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* File Tree */
.file-tree {
  overflow-y: auto;
  padding: 8px 0;
  flex: 1;
}

.tree-level {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 12px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  border-radius: 2px;
  transition: all var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-row:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tree-row.active {
  background: rgba(124, 111, 247, 0.15);
  color: var(--accent-primary);
  font-weight: 500;
}

.tree-arrow {
  flex-shrink: 0;
  width: 12px;
  font-size: 10px;
  color: var(--text-placeholder);
  text-align: center;
}

.tree-icon {
  flex-shrink: 0;
  width: 16px;
  font-size: 12px;
  text-align: center;
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Collapsed folder — hide children */
.tree-item.collapsed > .tree-level {
  display: none;
}

.tree-error {
  color: var(--accent-error);
  padding: 12px;
  font-size: var(--font-size-sm);
}

/* Sidebar collapsed state */
.file-sidebar.collapsed {
  width: 0 !important;
  min-width: 0;
  border-right: none;
  overflow: hidden;
}
```

---

## Step 5: Wire in `app.js`

```javascript
import { initFileTree, setActiveFile } from './fileTree.js';

// Get project from URL query param
const params = new URLSearchParams(window.location.search);
const projectSlug = params.get('project') || 'sample';

// Initialize file tree
await initFileTree(projectSlug, async (filePath) => {
  // Load the selected file into the editor
  const response = await fetch(`/api/projects/${projectSlug}/file?path=${encodeURIComponent(filePath)}`);
  const data = await response.json();
  if (data.content !== undefined) {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: data.content },
    });
    console.log(`Loaded file: ${filePath}`);
  }
});

// Mark the main file as active
const projectMeta = await (await fetch(`/api/projects/${projectSlug}`)).json();
setActiveFile(projectMeta.mainFile || 'main.tex');

// Sidebar toggle
document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
  document.getElementById('file-sidebar').classList.toggle('collapsed');
});
```

---

## Edge Cases

### 6.1 — Empty project
Tree shows nothing. Not an error — just empty.

### 6.2 — Binary files
`.png`, `.pdf`, etc. appear in the tree but should NOT be opened in the editor. When clicked, either show a preview or show a "Binary file — cannot edit" message. For Phase 4, just show the message.

### 6.3 — Very deep nesting
10+ nested folders should render correctly. The indentation (`paddingLeft: 16px * depth`) prevents overflow. Long file names truncate with `text-overflow: ellipsis`.

### 6.4 — File tree refresh after CRUD
After creating, renaming, or deleting a file (Feature 4.4), call `refreshTree()` to re-render. The tree should update without collapsing currently open folders. **Phase 4 simplification**: Just re-render the whole tree. Preserving collapse state is Phase 5+ polish.

### 6.5 — Active file deleted
If the currently open file is deleted, the editor should clear and show a placeholder. The tree row disappears.

### 6.6 — Sidebar takes too much space
Add a keyboard shortcut `Ctrl+B` to toggle the sidebar. On narrow screens, collapse by default.

---

## Final Acceptance Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | File tree sidebar appears on the left | ☐ |
| 2 | Tree shows all files and folders (excluding `output/`, `.git`) | ☐ |
| 3 | Folders show 📁 icon, sorted before files | ☐ |
| 4 | Clicking a folder collapses/expands its children | ☐ |
| 5 | Clicking a `.tex` file loads it in the editor | ☐ |
| 6 | Active file is highlighted (purple tint) | ☐ |
| 7 | File icons match file type (📝 for .tex, 📚 for .bib, etc.) | ☐ |
| 8 | Long file names truncate with ellipsis | ☐ |
| 9 | Tree scrolls vertically when many files | ☐ |
| 10 | Sidebar toggle button collapses/expands the sidebar | ☐ |
| 11 | `Ctrl+B` toggles sidebar | ☐ |
| 12 | Empty project shows empty tree (no error) | ☐ |
| 13 | Tree matches dark theme | ☐ |

> **Done → Proceed to Feature 4.4 (File/Folder CRUD).**

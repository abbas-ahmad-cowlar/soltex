# Feature 4.4 — File/Folder CRUD (Create, Rename, Delete)

> **Phase**: 4 | **Feature**: 4 of 11
> **Goal**: Right-click context menu on the file tree with New File, New Folder, Rename, and Delete actions.
> **Estimated Effort**: 3–4 hours
> **Dependencies**: Feature 4.3 (file tree sidebar).

---

## Step 1: Backend — CRUD Endpoints

Add to `server/routes/files.js`:

```javascript
/**
 * POST /api/projects/:project/files
 * Body: { path, type: 'file' | 'folder', content? }
 * Creates a new file or folder.
 */
router.post('/:project/files', async (req, res) => {
  const { project } = req.params;
  const { path: filePath, type, content = '' } = req.body;
  const projectDir = path.resolve(PROJECTS_DIR, project);
  const targetPath = path.resolve(projectDir, filePath);

  // Path traversal check
  if (!targetPath.startsWith(projectDir)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    if (type === 'folder') {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, 'utf-8');
    }

    // Update project.json updatedAt
    await touchProject(projectDir);

    res.status(201).json({ success: true, path: filePath });
  } catch (err) {
    console.error('Error creating file/folder:', err);
    res.status(500).json({ error: 'Failed to create' });
  }
});

/**
 * PUT /api/projects/:project/files
 * Body: { oldPath, newPath }
 * Renames/moves a file or folder.
 */
router.put('/:project/files', async (req, res) => {
  const { project } = req.params;
  const { oldPath, newPath } = req.body;
  const projectDir = path.resolve(PROJECTS_DIR, project);
  const oldFull = path.resolve(projectDir, oldPath);
  const newFull = path.resolve(projectDir, newPath);

  if (!oldFull.startsWith(projectDir) || !newFull.startsWith(projectDir)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    await fs.rename(oldFull, newFull);
    await touchProject(projectDir);
    res.json({ success: true, oldPath, newPath });
  } catch (err) {
    console.error('Error renaming:', err);
    res.status(500).json({ error: 'Failed to rename' });
  }
});

/**
 * DELETE /api/projects/:project/files
 * Body: { path }
 * Deletes a file or folder (recursively).
 */
router.delete('/:project/files', async (req, res) => {
  const { project } = req.params;
  const { path: filePath } = req.body;
  const projectDir = path.resolve(PROJECTS_DIR, project);
  const targetPath = path.resolve(projectDir, filePath);

  if (!targetPath.startsWith(projectDir)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  // Prevent deleting the project root
  if (targetPath === projectDir) {
    return res.status(400).json({ error: 'Cannot delete project root' });
  }

  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    await touchProject(projectDir);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

/**
 * Update the updatedAt timestamp in project.json.
 */
async function touchProject(projectDir) {
  const metaPath = path.join(projectDir, 'project.json');
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw);
    meta.updatedAt = new Date().toISOString();
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch { /* ignore if project.json doesn't exist */ }
}
```

---

## Step 2: Frontend — Context Menu

### Context Menu HTML
Add to `src/editor.html`:
```html
<div id="context-menu" class="context-menu" style="display: none;">
  <button class="ctx-item" data-action="new-file">📝 New File</button>
  <button class="ctx-item" data-action="new-folder">📁 New Folder</button>
  <hr class="ctx-divider" />
  <button class="ctx-item" data-action="rename">✏️ Rename</button>
  <button class="ctx-item ctx-danger" data-action="delete">🗑️ Delete</button>
</div>
```

### Context Menu Logic (in `fileTree.js`)

```javascript
let contextTarget = null; // { path, type, element }

// Attach right-click to each tree row:
row.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  contextTarget = { path: item.path, type: item.type, element: row };
  showContextMenu(e.clientX, e.clientY);
});

function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  menu.style.display = 'block';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

function hideContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
  contextTarget = null;
}

// Close on click elsewhere
document.addEventListener('click', hideContextMenu);

// Handle context menu actions
document.getElementById('context-menu').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  hideContextMenu();

  switch (action) {
    case 'new-file':
      const fileName = prompt('File name:');
      if (!fileName) return;
      const filePath = contextTarget?.type === 'folder'
        ? `${contextTarget.path}/${fileName}`
        : fileName;
      await fetch(`/api/projects/${currentProject}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, type: 'file' }),
      });
      await refreshTree();
      break;

    case 'new-folder':
      const folderName = prompt('Folder name:');
      if (!folderName) return;
      const folderPath = contextTarget?.type === 'folder'
        ? `${contextTarget.path}/${folderName}`
        : folderName;
      await fetch(`/api/projects/${currentProject}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath, type: 'folder' }),
      });
      await refreshTree();
      break;

    case 'rename':
      const newName = prompt('New name:', contextTarget.path.split('/').pop());
      if (!newName || !contextTarget) return;
      const parentDir = contextTarget.path.includes('/')
        ? contextTarget.path.substring(0, contextTarget.path.lastIndexOf('/'))
        : '';
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;
      await fetch(`/api/projects/${currentProject}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: contextTarget.path, newPath }),
      });
      await refreshTree();
      break;

    case 'delete':
      if (!contextTarget) return;
      if (!confirm(`Delete "${contextTarget.path}"? This cannot be undone.`)) return;
      await fetch(`/api/projects/${currentProject}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: contextTarget.path }),
      });
      await refreshTree();
      break;
  }
});
```

### Context Menu CSS
```css
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  padding: 4px 0;
  z-index: 300;
  min-width: 180px;
}

.ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 6px 16px;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.ctx-item:hover { background: var(--bg-tertiary); }
.ctx-danger { color: var(--accent-error); }
.ctx-danger:hover { background: rgba(255, 69, 58, 0.15); }
.ctx-divider { border: none; border-top: 1px solid var(--border-color); margin: 4px 0; }
```

---

## Edge Cases

- **Delete currently open file**: Editor should show a "No file open" placeholder
- **Rename to existing name**: `fs.rename()` overwrites. Consider adding a confirmation.
- **Create file in root vs. in folder**: If context-click is on a folder, create inside it. If on a file or blank area, create in root.
- **Delete folder with contents**: `fs.rm({ recursive: true })` handles it. The confirm dialog warns the user.

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Right-click on tree item shows context menu | ☐ |
| 2 | "New File" creates a file (prompts for name) | ☐ |
| 3 | "New Folder" creates a folder | ☐ |
| 4 | "Rename" renames the item | ☐ |
| 5 | "Delete" deletes with confirmation | ☐ |
| 6 | File tree refreshes after each operation | ☐ |
| 7 | Path traversal is blocked on all endpoints | ☐ |
| 8 | Context menu closes on click elsewhere | ☐ |
| 9 | Context menu styled to match dark theme | ☐ |

> **Done → Proceed to Features 4.5–4.7.**

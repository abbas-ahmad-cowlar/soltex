# Features 4.8–4.11 — Project Metadata & Operations

> **Phase**: 4 | **Features**: 8, 9, 10, 11
> **Goal**: Main document selection, project tagging/filtering, archive/trash/clone, and project rename.
> **Estimated Effort**: 5–6 hours total
> **Dependencies**: Feature 4.1 (dashboard + projects API), Feature 4.2 (project creation).

---

## Feature 4.8 — Main Document Selection

### What It Does
Lets the user designate which `.tex` file is the compilation entry point. Defaults to `main.tex`. Stored in `project.json` as `mainFile`.

### Backend
Add to `server/routes/projects.js`:

```javascript
/**
 * PUT /api/projects/:name
 * Body: { mainFile?, name?, tags?, archived? }
 * Updates project metadata.
 */
router.put('/:name', async (req, res) => {
  const { name } = req.params;
  const projectDir = path.resolve(PROJECTS_DIR, name);

  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  const metaPath = path.join(projectDir, 'project.json');

  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw);

    // Update only provided fields
    if (req.body.mainFile !== undefined) meta.mainFile = req.body.mainFile;
    if (req.body.name !== undefined) meta.name = req.body.name;
    if (req.body.tags !== undefined) meta.tags = req.body.tags;
    if (req.body.archived !== undefined) meta.archived = req.body.archived;
    meta.updatedAt = new Date().toISOString();

    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    res.json(meta);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});
```

This single `PUT` endpoint serves Features 4.8, 4.9, and 4.11.

### Frontend — Main File Dropdown
Add to the editor toolbar:

```html
<select id="main-file-select" class="toolbar-select" title="Main compilation file">
  <!-- Populated by JS — lists all .tex files in the project -->
</select>
```

```javascript
// Populate the dropdown with .tex files from the file tree
async function populateMainFileDropdown(project) {
  const response = await fetch(`/api/projects/${project}/files`);
  const data = await response.json();
  const texFiles = findTexFiles(data.tree); // Recursive helper

  const select = document.getElementById('main-file-select');
  select.innerHTML = texFiles.map(f =>
    `<option value="${f.path}" ${f.path === projectMeta.mainFile ? 'selected' : ''}>${f.path}</option>`
  ).join('');

  select.addEventListener('change', async () => {
    await fetch(`/api/projects/${project}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainFile: select.value }),
    });
    console.log(`Main file set to: ${select.value}`);
  });
}

function findTexFiles(items, result = []) {
  for (const item of items) {
    if (item.type === 'file' && item.name.endsWith('.tex')) result.push(item);
    if (item.children) findTexFiles(item.children, result);
  }
  return result;
}
```

### CSS
```css
.toolbar-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  padding: 4px 8px;
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
  cursor: pointer;
  outline: none;
}

.toolbar-select:focus { border-color: var(--accent-primary); }
```

---

## Feature 4.9 — Project Tagging & Filtering

### What It Does
Assign colored tags to projects on the dashboard. Filter by tag.

### Backend
Uses the same `PUT /api/projects/:name` endpoint (already built in 4.8). Tags are an array of strings stored in `project.json`.

### Frontend — Dashboard Tag Chips

```javascript
// In dashboard.js — add tag management to each project card:

// Add to projectCard() template:
// <button class="card-action" data-action="add-tag" data-slug="${project.slug}">+ Tag</button>

// Tag assignment handler:
async function addTag(slug) {
  const tag = prompt('Tag name (e.g., Thesis, Homework, Report):');
  if (!tag) return;

  const project = allProjects.find(p => p.slug === slug);
  if (!project) return;

  const tags = [...project.tags, tag.trim()];
  await fetch(`/api/projects/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });

  await loadProjects(); // Refresh
}
```

### Tag Filter Bar
```javascript
function renderTagFilters() {
  const allTags = [...new Set(allProjects.flatMap(p => p.tags))];
  const container = document.getElementById('tag-filters');

  container.innerHTML = allTags.map(tag =>
    `<button class="tag-filter tag tag-${tag.toLowerCase()}" data-tag="${tag}">${tag}</button>`
  ).join('');

  container.querySelectorAll('.tag-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      renderProjects(); // Re-filter with active tags
    });
  });
}
```

### Edge Cases
- **Custom tag names**: Any string is allowed. Keep under 20 characters.
- **Removing tags**: Right-click a tag chip → remove option. Or click the × on the chip.
- **Predefined colors**: Use a small palette. Unknown tags get a default gray color.

---

## Feature 4.10 — Archive / Trash / Clone Projects

### Archive
Toggles the `archived` field in `project.json`. Archived projects are hidden from the dashboard by default (shown with "Show Archived" toggle).

```javascript
// Dashboard — archive button handler:
async function archiveProject(slug) {
  const project = allProjects.find(p => p.slug === slug);
  await fetch(`/api/projects/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived: !project.archived }),
  });
  await loadProjects();
}
```

### Trash (Soft Delete)
Move the project directory into a `_trash/` folder.

```javascript
/**
 * DELETE /api/projects/:name
 * Moves project to _trash/ instead of permanent deletion.
 */
router.delete('/:name', async (req, res) => {
  const { name } = req.params;
  const projectDir = path.resolve(PROJECTS_DIR, name);
  const trashDir = path.resolve(PROJECTS_DIR, '_trash');

  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    await fs.mkdir(trashDir, { recursive: true });
    const trashPath = path.join(trashDir, `${name}_${Date.now()}`);
    await fs.rename(projectDir, trashPath);
    res.json({ success: true });
  } catch (err) {
    console.error('Error trashing project:', err);
    res.status(500).json({ error: 'Failed to trash project' });
  }
});
```

**Key**: We append a timestamp to the trashed name to avoid collisions (e.g., `my-thesis_1714060000000`).

### Clone (Duplicate)
Copy the entire project directory to a new name.

```javascript
/**
 * POST /api/projects/:name/clone
 * Clones the project directory.
 */
router.post('/:name/clone', async (req, res) => {
  const { name } = req.params;
  const projectDir = path.resolve(PROJECTS_DIR, name);
  const cloneName = `${name}-copy`;
  const cloneDir = path.resolve(PROJECTS_DIR, cloneName);

  if (!projectDir.startsWith(PROJECTS_DIR)) {
    return res.status(403).json({ error: 'Path traversal' });
  }

  try {
    await fs.cp(projectDir, cloneDir, { recursive: true });

    // Update the cloned project's metadata
    const metaPath = path.join(cloneDir, 'project.json');
    const raw = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw);
    meta.name = `${meta.name} (Copy)`;
    meta.createdAt = new Date().toISOString();
    meta.updatedAt = new Date().toISOString();
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    res.json({ success: true, slug: cloneName });
  } catch (err) {
    console.error('Error cloning project:', err);
    res.status(500).json({ error: 'Failed to clone project' });
  }
});
```

---

## Feature 4.11 — Project Rename

### What It Does
Rename a project from the dashboard or within the editor. Updates both the directory name and the `name` field in `project.json`.

### Implementation
1. Frontend prompts for new name
2. Calls `PUT /api/projects/:name` to update the display name in `project.json`
3. If the slug also needs to change: create a new slug, rename the directory, update the URL

```javascript
// Dashboard — rename handler:
async function renameProject(slug) {
  const project = allProjects.find(p => p.slug === slug);
  const newName = prompt('New project name:', project.name);
  if (!newName || newName === project.name) return;

  await fetch(`/api/projects/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName.trim() }),
  });

  await loadProjects();
}
```

**Note**: This only changes the display name, not the directory. Renaming the directory would break open editor sessions. Keep slug immutable for Phase 4.

---

## Final Acceptance Checklist — Features 4.8–4.11

| # | Check | Status |
|---|-------|--------|
| 1 | Main file dropdown shows all `.tex` files | ☐ |
| 2 | Changing main file → next compile uses the new file | ☐ |
| 3 | Main file stored in `project.json` | ☐ |
| 4 | Tags can be added to projects on dashboard | ☐ |
| 5 | Tag chips display with color | ☐ |
| 6 | Filter by tag works on dashboard | ☐ |
| 7 | Archive toggles project visibility | ☐ |
| 8 | "Show Archived" toggle reveals archived projects | ☐ |
| 9 | Delete moves project to `_trash/` (soft delete) | ☐ |
| 10 | Clone duplicates all project files | ☐ |
| 11 | Clone creates `project-copy` with updated metadata | ☐ |
| 12 | Rename updates the display name | ☐ |
| 13 | All operations refresh the dashboard | ☐ |

> **Phase 4 is DONE when all checklists pass. Run the Phase 4 Integration Test Plan.**

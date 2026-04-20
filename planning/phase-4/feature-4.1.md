# Feature 4.1 — Project Dashboard Page

> **Phase**: 4 | **Feature**: 1 of 11
> **Goal**: Create a landing page that lists all projects with title, last-modified date, and tags. Supports list and grid view. Click a project to open it in the editor.
> **Estimated Effort**: 4–6 hours
> **Dependencies**: None (first feature of Phase 4).

---

## Overview

Three components:

1. **Backend**: `GET /api/projects` endpoint that scans the `projects/` directory
2. **Frontend**: `dashboard.html` + `dashboard.js` + `dashboard.css` — a new page
3. **Project metadata**: `project.json` in each project folder

---

## Step 1: Backend — List Projects API

### File: `server/routes/projects.js`

```javascript
// server/routes/projects.js
import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();
const PROJECTS_DIR = path.resolve(process.cwd(), "projects");

/**
 * GET /api/projects
 * Returns a list of all projects with metadata.
 */
router.get("/", async (req, res) => {
  try {
    // Ensure projects directory exists
    await fs.mkdir(PROJECTS_DIR, { recursive: true });

    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_")) continue; // Skip _archive, _trash, etc.

      const projectDir = path.join(PROJECTS_DIR, entry.name);
      const metaPath = path.join(projectDir, "project.json");

      let metadata;
      try {
        const raw = await fs.readFile(metaPath, "utf-8");
        metadata = JSON.parse(raw);
      } catch {
        // No project.json — create a default one
        metadata = createDefaultMetadata(entry.name);
        await fs.writeFile(
          metaPath,
          JSON.stringify(metadata, null, 2),
          "utf-8",
        );
      }

      // Get directory stats for last modified
      const stat = await fs.stat(projectDir);

      projects.push({
        slug: entry.name, // Directory name (URL-safe)
        name: metadata.name || entry.name, // Display name
        mainFile: metadata.mainFile || "main.tex",
        createdAt: metadata.createdAt || stat.birthtime.toISOString(),
        updatedAt: metadata.updatedAt || stat.mtime.toISOString(),
        tags: metadata.tags || [],
        archived: metadata.archived || false,
      });
    }

    // Sort by updatedAt descending (most recent first)
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ projects });
  } catch (err) {
    console.error("Error listing projects:", err);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

/**
 * Create default metadata for a project without project.json.
 */
function createDefaultMetadata(dirName) {
  return {
    name: dirName,
    mainFile: "main.tex",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    archived: false,
  };
}

export default router;
```

### Key Design Decisions

- **Auto-create `project.json`**: If a project folder exists but has no `project.json`, we create one automatically. This handles the case where the user manually creates a folder in the `projects/` directory.
- **Skip `_` prefixed dirs**: Directories like `_archive` and `_trash` are internal. Don't list them as projects.
- **Sort by recent**: Most recently modified projects appear first.

---

## Step 2: Frontend — Dashboard Page

### File: `src/dashboard.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SolteX — Projects</title>
    <meta
      name="description"
      content="Your local LaTeX workspace. Manage and edit LaTeX projects."
    />
    <link rel="stylesheet" href="/css/style.css" />
    <link rel="stylesheet" href="/css/dashboard.css" />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <header class="dashboard-header">
      <div class="header-left">
        <h1 class="logo">🍃 SolteX</h1>
        <span class="header-subtitle">Your LaTeX Workspace</span>
      </div>
      <div class="header-right">
        <div class="view-toggle">
          <button
            id="btn-grid-view"
            class="btn btn-icon-only btn-active"
            title="Grid view"
          >
            ▦
          </button>
          <button
            id="btn-list-view"
            class="btn btn-icon-only"
            title="List view"
          >
            ☰
          </button>
        </div>
        <button id="btn-new-project" class="btn btn-primary">
          <span>+ New Project</span>
        </button>
      </div>
    </header>

    <main class="dashboard-main">
      <div class="dashboard-toolbar">
        <input
          id="search-projects"
          type="text"
          class="search-input"
          placeholder="Search projects..."
        />
        <div id="tag-filters" class="tag-filters"></div>
        <label class="toggle-label">
          <input type="checkbox" id="show-archived" /> Show Archived
        </label>
      </div>

      <div id="projects-container" class="projects-grid">
        <!-- Populated by dashboard.js -->
        <p class="loading-text">Loading projects...</p>
      </div>
    </main>

    <!-- New Project Modal -->
    <div id="new-project-modal" class="modal-overlay" style="display: none;">
      <div class="modal-box">
        <h2 class="modal-title">Create New Project</h2>
        <label class="dialog-label" for="new-project-name">Project Name</label>
        <input
          id="new-project-name"
          class="dialog-input"
          type="text"
          placeholder="e.g., My Thesis"
          autocomplete="off"
        />
        <div class="modal-actions">
          <button id="modal-cancel" class="btn btn-ghost">Cancel</button>
          <button id="modal-create" class="btn btn-primary">Create</button>
        </div>
        <p id="modal-error" class="modal-error" style="display: none;"></p>
      </div>
    </div>

    <script type="module" src="/js/dashboard.js"></script>
  </body>
</html>
```

---

## Step 3: Dashboard JavaScript

### File: `src/js/dashboard.js`

```javascript
// src/js/dashboard.js

let allProjects = [];
let viewMode = "grid"; // 'grid' | 'list'
let showArchived = false;

document.addEventListener("DOMContentLoaded", async () => {
  await loadProjects();

  // View toggle
  document
    .getElementById("btn-grid-view")
    .addEventListener("click", () => setView("grid"));
  document
    .getElementById("btn-list-view")
    .addEventListener("click", () => setView("list"));

  // Search
  document
    .getElementById("search-projects")
    .addEventListener("input", renderProjects);

  // Show archived toggle
  document.getElementById("show-archived").addEventListener("change", (e) => {
    showArchived = e.target.checked;
    renderProjects();
  });

  // New project button
  document
    .getElementById("btn-new-project")
    .addEventListener("click", openNewProjectModal);
  document
    .getElementById("modal-cancel")
    .addEventListener("click", closeNewProjectModal);
  document
    .getElementById("modal-create")
    .addEventListener("click", createProject);
  document
    .getElementById("new-project-name")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") createProject();
      if (e.key === "Escape") closeNewProjectModal();
    });
});

async function loadProjects() {
  try {
    const response = await fetch("/api/projects");
    const data = await response.json();
    allProjects = data.projects;
    renderProjects();
  } catch (err) {
    console.error("Failed to load projects:", err);
    document.getElementById("projects-container").innerHTML =
      '<p class="error-text">Failed to load projects. Is the server running?</p>';
  }
}

function renderProjects() {
  const container = document.getElementById("projects-container");
  const searchTerm = document
    .getElementById("search-projects")
    .value.toLowerCase();

  let filtered = allProjects.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = searchTerm
      ? '<p class="empty-text">No projects match your search.</p>'
      : '<p class="empty-text">No projects yet. Click "New Project" to get started!</p>';
    return;
  }

  container.className = viewMode === "grid" ? "projects-grid" : "projects-list";
  container.innerHTML = filtered.map((p) => projectCard(p)).join("");

  // Attach click handlers
  container.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = `/editor.html?project=${card.dataset.slug}`;
    });
  });
}

function projectCard(project) {
  const date = new Date(project.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const tags = project.tags
    .map((t) => `<span class="tag tag-${t.toLowerCase()}">${t}</span>`)
    .join("");

  return `
    <div class="project-card" data-slug="${project.slug}">
      <div class="card-icon">📄</div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(project.name)}</h3>
        <p class="card-date">Modified ${date}</p>
        <div class="card-tags">${tags}</div>
      </div>
      ${project.archived ? '<span class="card-badge">Archived</span>' : ""}
    </div>
  `;
}

function setView(mode) {
  viewMode = mode;
  document
    .getElementById("btn-grid-view")
    .classList.toggle("btn-active", mode === "grid");
  document
    .getElementById("btn-list-view")
    .classList.toggle("btn-active", mode === "list");
  renderProjects();
}

// ... modal functions, createProject, etc.

function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
```

---

## Step 4: Dashboard CSS

### File: `src/css/dashboard.css`

```css
/* Dashboard Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
}

.logo {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-subtitle {
  color: var(--text-placeholder);
  font-size: var(--font-size-sm);
  margin-left: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  padding: 2px;
}

/* Dashboard Main */
.dashboard-main {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.search-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  padding: 8px 14px;
  font-size: var(--font-size-md);
  width: 300px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent-primary);
}

.toggle-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Grid View */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

/* List View */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.projects-list .project-card {
  flex-direction: row;
  padding: 12px 16px;
}

/* Project Card */
.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 20px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.project-card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-icon {
  font-size: 32px;
}
.card-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-date {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
}

.card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

/* Tag colors (predefined) */
.tag-thesis {
  background: #7c6ff7;
  color: white;
}
.tag-homework {
  background: #f7a846;
  color: #1a1a2e;
}
.tag-report {
  background: #46c8f7;
  color: #1a1a2e;
}

.card-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  color: var(--text-placeholder);
  font-style: italic;
}

/* Empty states */
.empty-text,
.loading-text,
.error-text {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-placeholder);
  font-size: var(--font-size-md);
}

.error-text {
  color: var(--accent-error);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-title {
  margin: 0 0 16px;
  font-size: 18px;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.modal-error {
  color: var(--accent-error);
  font-size: var(--font-size-sm);
  margin-top: 8px;
}
```

---

## Edge Cases

### 5.1 — No projects

Dashboard shows "No projects yet" with a prompt to create one.

### 5.2 — Server unreachable

Shows an error message. Doesn't crash.

### 5.3 — Project folder with no `project.json`

Backend auto-creates a default `project.json`.

### 5.4 — Special characters in project names

The `slug` (directory name) must be URL-safe. The `name` (display name) can have any characters. When creating a project, sanitize the slug: replace spaces with hyphens, remove special characters.

### 5.5 — Many projects (100+)

The grid/list should handle 100+ projects without lag. No pagination needed for local use.

---

## Final Acceptance Checklist

| #   | Check                                         | Status |
| --- | --------------------------------------------- | ------ |
| 1   | Dashboard page loads at `/` or `/dashboard`   | ☐      |
| 2   | Projects are listed with name, date, and tags | ☐      |
| 3   | Grid view shows project cards in a grid       | ☐      |
| 4   | List view shows projects in a compact list    | ☐      |
| 5   | Toggle between grid/list works                | ☐      |
| 6   | Search filters projects by name               | ☐      |
| 7   | "Show Archived" toggle works                  | ☐      |
| 8   | Clicking a project navigates to editor        | ☐      |
| 9   | "New Project" button opens modal              | ☐      |
| 10  | Modal has name input, Create/Cancel buttons   | ☐      |
| 11  | Empty state shows helpful message             | ☐      |
| 12  | Cards have hover effect (lift + shadow)       | ☐      |
| 13  | Dark theme matches editor theme               | ☐      |

> **Done → Proceed to Feature 4.2.**

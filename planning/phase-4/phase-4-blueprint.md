# Phase 4 Blueprint — File & Project Management

> **Phase**: 4 of 7
> **Goal**: Transform SolteX from a single-file editor into a multi-project, multi-file platform. This phase adds a project dashboard, a file tree sidebar, full CRUD operations for files/folders, file uploads, ZIP import/export, and project metadata management.
> **Estimated Effort**: 2–3 weeks
> **Prerequisite**: Phases 1–3 are complete. The editor, compiler, and preview are fully functional for a single file.

---

## What Phase 4 Delivers

When Phase 4 is complete, the user should be able to:

1. See all their projects on a dashboard page (list/grid view)
2. Create a new project (blank or from a template starter)
3. Browse the file tree of any project in a sidebar
4. Create, rename, and delete files and folders
5. Upload files via drag-and-drop or file picker
6. Upload a `.zip` and have it auto-extracted
7. Download the entire project as a `.zip`
8. Select which `.tex` file is the main compilation target
9. Tag projects with colored labels and filter by them
10. Archive, trash, or clone projects
11. Rename projects

**Key Insight**: This is the most architecturally significant phase. It introduces:

- A **second page** (dashboard) — SolteX is no longer a single-page app
- A **sidebar** in the editor — the layout changes from 2-panel to 3-panel
- **Multiple backend routes** — new API surface for project/file CRUD
- **`project.json`** — per-project metadata file

---

## Architecture Changes

### Page Structure

SolteX now has **two pages**:

| Page      | URL                      | Purpose                 |
| --------- | ------------------------ | ----------------------- |
| Dashboard | `/` or `/dashboard`      | List all projects       |
| Editor    | `/editor?project=<name>` | Open a specific project |

**Routing**: We use simple hash-based routing or query-string routing (no SPA framework). When the user clicks a project on the dashboard, we navigate to `/editor?project=my-thesis`.

### New Layout (Editor Page)

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar: [← Dashboard] [Compile] [Draft] [Logs] [Auto] zoom │
├────────┬──────────────────────┬──┬───────────────────────────┤
│ File   │                      │  │                           │
│ Tree   │   Editor Panel       │▐▐│   PDF Preview Panel       │
│        │   (CodeMirror)       │▐▐│   (pdf.js canvases)       │
│ main.tex│                     │  │                           │
│ refs.bib│──────────────────────┤  │                           │
│ img/   │ Log Panel            │  │                           │
│  fig1.png                     │  │                           │
└────────┴──────────────────────┴──┴───────────────────────────┘
```

The file tree sidebar is a new column on the left, ~200px wide, collapsible.

### New Backend Routes

| Method   | Route                            | Purpose                 |
| -------- | -------------------------------- | ----------------------- |
| `GET`    | `/api/projects`                  | List all projects       |
| `POST`   | `/api/projects`                  | Create new project      |
| `GET`    | `/api/projects/:name`            | Get project metadata    |
| `PUT`    | `/api/projects/:name`            | Update project metadata |
| `DELETE` | `/api/projects/:name`            | Delete project (trash)  |
| `POST`   | `/api/projects/:name/clone`      | Clone project           |
| `POST`   | `/api/projects/:name/archive`    | Archive/unarchive       |
| `GET`    | `/api/projects/:name/files`      | List all files (tree)   |
| `POST`   | `/api/projects/:name/files`      | Create file/folder      |
| `PUT`    | `/api/projects/:name/files`      | Rename file/folder      |
| `DELETE` | `/api/projects/:name/files`      | Delete file/folder      |
| `POST`   | `/api/projects/:name/upload`     | Upload files            |
| `POST`   | `/api/projects/:name/upload-zip` | Upload + extract ZIP    |
| `GET`    | `/api/projects/:name/download`   | Download as ZIP         |

### New Files

| File                        | Purpose                               |
| --------------------------- | ------------------------------------- |
| `src/dashboard.html`        | **[NEW]** Dashboard page              |
| `src/js/dashboard.js`       | **[NEW]** Dashboard page logic        |
| `src/js/fileTree.js`        | **[NEW]** File tree sidebar component |
| `src/css/dashboard.css`     | **[NEW]** Dashboard-specific styles   |
| `server/routes/projects.js` | **[NEW]** Project CRUD routes         |
| `server/routes/files.js`    | **[NEW]** File/folder CRUD routes     |
| `server/routes/upload.js`   | **[NEW]** Upload/download routes      |

### `project.json` Schema

Each project directory contains a `project.json`:

```json
{
  "name": "My Thesis",
  "mainFile": "main.tex",
  "createdAt": "2026-04-25T00:00:00.000Z",
  "updatedAt": "2026-04-25T12:30:00.000Z",
  "tags": ["thesis", "physics"],
  "archived": false
}
```

---

## Feature Summary Table

| #    | Feature                 | Effort  | Frontend           | Backend                |
| ---- | ----------------------- | ------- | ------------------ | ---------------------- |
| 4.1  | Project Dashboard       | 4–6 hrs | New page           | `GET /api/projects`    |
| 4.2  | Create New Project      | 2–3 hrs | Modal dialog       | `POST /api/projects`   |
| 4.3  | File Tree Sidebar       | 6–8 hrs | New component      | `GET /api/.../files`   |
| 4.4  | File/Folder CRUD        | 3–4 hrs | Context menu       | CRUD endpoints         |
| 4.5  | Upload (Drag-and-Drop)  | 2–3 hrs | DnD handlers       | `POST /api/.../upload` |
| 4.6  | Upload ZIP              | 1–2 hrs | Upload button      | Extract endpoint       |
| 4.7  | Download as ZIP         | 1–2 hrs | Download button    | Stream ZIP             |
| 4.8  | Main Document Selection | 1 hr    | Dropdown           | `project.json`         |
| 4.9  | Project Tagging         | 2–3 hrs | Tag chips + filter | `project.json`         |
| 4.10 | Archive/Trash/Clone     | 2–3 hrs | Dashboard actions  | Move/copy dirs         |
| 4.11 | Project Rename          | 30 min  | Inline edit        | Rename dir             |

**Total estimated effort**: 25–36 hours

---

## Implementation Order

```
Group A — Backend Foundation
  4.1 (project listing API) → 4.2 (create project)

Group B — File Tree (biggest chunk)
  4.3 (tree UI) → 4.4 (CRUD)

Group C — Upload/Download
  4.5 (drag-and-drop) → 4.6 (ZIP upload) → 4.7 (ZIP download)

Group D — Project Metadata
  4.8 (main file selection) → 4.9 (tagging)

Group E — Project Operations
  4.10 (archive/trash/clone) → 4.11 (rename)
```

**Rationale**:

- Dashboard (4.1) and project creation (4.2) must come first — they establish the project model and API
- File tree (4.3) is the central UI component that everything else builds on
- CRUD (4.4) naturally follows the file tree
- Upload/download are independent features that use the established API patterns
- Project metadata features are polish that depends on `project.json` being established

---

## Key Design Decisions

### Single-User, Local-First

There is no authentication. The `projects/` directory is a local folder. All projects belong to the one user. This simplifies everything — no user model, no sessions, no permissions. If we add online hosting later (Phase 7+), we'll add auth then.

### `project.json` as Single Source of Metadata

Rather than a global database, each project folder contains its own `project.json`. This means:

- Projects are fully self-contained (can be copied/backed up by just copying the folder)
- No database setup or migration needed
- If `project.json` is missing, create a default one on first access

### File Tree Excludes Output

The file tree should NOT show the `output/` directory (where compiled PDFs live) or `project.json` itself. These are implementation details, not user files.

### Security: Path Traversal Prevention

Every file/folder API endpoint MUST validate that the resolved path is inside the project directory. Use the same `path.resolve` + `startsWith` pattern from Phase 1. This is critical — a malicious path like `../../../etc/passwd` must be rejected.

---

## Phase 4 Integration Test Plan

### Full Workflow

1. Open SolteX → Dashboard page shows
2. Click "New Project" → modal opens → enter "My Report" → project created
3. Dashboard now shows "My Report" with today's date
4. Click "My Report" → Editor opens with file tree sidebar on the left
5. File tree shows `main.tex` → click it → editor loads `main.tex`
6. Right-click in file tree → "New File" → create `refs.bib` → appears in tree
7. Right-click on `refs.bib` → "Rename" → rename to `references.bib`
8. Right-click → "New Folder" → create `images/` → folder appears with icon
9. Drag `figure1.png` from desktop into file tree → file uploads into `images/`
10. Upload a `.zip` → files extracted into project
11. Click "Download ZIP" → downloads the project as a `.zip`
12. In toolbar → "Main file" dropdown → select a different `.tex` file → compile uses it
13. On Dashboard → add tag "Report" to the project → filter by tag works
14. Dashboard → click "..." menu → "Clone" → duplicate project appears
15. Dashboard → "Archive" project → it disappears → toggle "Show Archived" → it reappears
16. Dashboard → "Rename" → inline edit the name → updated
17. Compile + Preview → still works with the new file structure

### Edge Cases

1. Create project with same name as existing → should fail with error
2. Delete the currently-open file → editor should show placeholder
3. Rename `main.tex` → project.json's `mainFile` should NOT auto-update (user must manually change it in settings)
4. Upload file with same name → overwrite with confirmation
5. Empty project (no files) → dashboard still shows it, editor shows empty tree
6. Very deep directory nesting (10+ levels) → file tree handles it
7. Large file upload (50MB image) → should work, maybe with a progress indicator

---

> **Phase 4 is complete when all integration tests pass.**
>
> Next: Proceed to Phase 5 (Search, Spell Check, Templates & Bibliography).

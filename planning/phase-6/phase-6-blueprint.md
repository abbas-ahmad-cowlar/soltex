# Phase 6 Blueprint — Checkpoints (Version History) & Settings

> **Phase**: 6 of 7
> **Goal**: Implement a checkpoint/snapshot system backed by Git so users can save, browse, and restore previous versions of their project. Also build a comprehensive settings panel for editor and compilation preferences.
> **Estimated Effort**: 2–3 weeks
> **Prerequisite**: Phases 1–5 complete. The app has a full editor, compilation pipeline, file management, search, spell check, and templates.

---

## What Phase 6 Delivers

When Phase 6 is complete, the user should be able to:

1. Have every new project auto-initialized with a hidden Git repo
2. Save a "checkpoint" (commit) at any time with `Ctrl+S` or a button
3. Browse the full checkpoint history in a panel (timestamps, labels, changed files)
4. Restore the project to any previous checkpoint (with auto-save of current state first)
5. View side-by-side diffs between two checkpoints
6. Label checkpoints with descriptive names ("Before reformatting", "v1 submitted")
7. Have files auto-saved to disk periodically (separate from checkpoints — no commit)
8. Configure all editor/compiler preferences in a settings panel

**Key Insight**: This phase has two distinct subsystems:

- **Checkpoints (6.1–6.6)**: Git-backed version history. Uses `simple-git` (npm) for all Git operations. No manual Git CLI usage required by the user — SolteX handles everything under the hood.
- **Settings (6.7–6.8)**: Auto-save and a comprehensive preferences panel. Uses `localStorage` for browser persistence + a `settings.json` file for project-specific overrides.

---

## Architecture Changes

### New npm Dependencies

```bash
npm install simple-git diff2html
```

| Package      | Purpose                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `simple-git` | Node.js wrapper for Git CLI. Handles `init`, `add`, `commit`, `log`, `diff`, `checkout`. |
| `diff2html`  | Renders Git diffs as HTML (side-by-side or inline).                                      |

### New Files

| File                           | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `server/utils/gitManager.js`   | **[NEW]** Centralized Git operations module |
| `server/routes/checkpoints.js` | **[NEW]** Checkpoint API endpoints          |
| `src/js/checkpointPanel.js`    | **[NEW]** History panel UI component        |
| `src/js/diffViewer.js`         | **[NEW]** Side-by-side diff modal           |
| `src/js/settings.js`           | **[NEW]** Settings panel logic              |
| `src/js/autoSave.js`           | **[NEW]** Periodic auto-save module         |
| `src/css/settings.css`         | **[NEW]** Settings panel styles             |

### Modified Files

| File                        | What Changes                                              |
| --------------------------- | --------------------------------------------------------- |
| `server/routes/projects.js` | Add `git init` to project creation                        |
| `server/routes/files.js`    | Exclude `.git` from file tree (already done)              |
| `src/index.html`            | Add checkpoint panel, settings modal, auto-save indicator |
| `src/js/app.js`             | Wire checkpoint panel, settings, and auto-save            |
| `src/js/editor.js`          | Apply settings (font, theme, keybindings) dynamically     |

### New Backend Routes

| Method | Route                                  | Purpose                          |
| ------ | -------------------------------------- | -------------------------------- |
| `POST` | `/api/projects/:name/checkpoint`       | Create a new checkpoint (commit) |
| `GET`  | `/api/projects/:name/checkpoints`      | List all checkpoints (git log)   |
| `POST` | `/api/projects/:name/restore`          | Restore to a checkpoint          |
| `GET`  | `/api/projects/:name/diff`             | Get diff between two checkpoints |
| `PUT`  | `/api/projects/:name/checkpoint/:hash` | Update checkpoint label          |

### Layout Change

The sidebar gets a fourth tab:

```
┌──────────────────────────────────────────────────────────────────┐
│ Toolbar: [← Dash] [Compile] [💾 Save] [⚙ Settings]  | zoom    │
├──────────┬──────────────────────┬──┬─────────────────────────────┤
│ [📁][🔍][📑][🕐]               │  │                             │
│ ──────────                     │  │                             │
│ Tab: Files │   Editor Panel    │▐▐│    PDF Preview Panel        │
│  or Search │   (CodeMirror)    │▐▐│    (pdf.js canvases)        │
│  or Outline│                   │  │                             │
│  or History│───────────────────┤  │                             │
│            │ Log Panel         │  │                             │
├────────────┴───────────────────┤  │                             │
│ Status: Ln 42, Col 15 | Words: 2,341 | Auto-saved 5s ago       │
└────────────────────────────────┴──┴─────────────────────────────┘
```

New elements:

- 🕐 **History** tab in sidebar — checkpoint list
- 💾 **Save Checkpoint** button in toolbar
- ⚙ **Settings** button → opens settings modal
- Auto-save indicator in status bar

---

## Feature Summary Table

| #   | Feature                  | Effort  | Frontend         | Backend              | New Module?          |
| --- | ------------------------ | ------- | ---------------- | -------------------- | -------------------- |
| 6.1 | Git Auto-Init            | 30 min  | —                | `git init` on create | `gitManager.js`      |
| 6.2 | Manual Checkpoint        | 2–3 hrs | Save button      | `git add + commit`   | `checkpoints.js`     |
| 6.3 | Checkpoint History Panel | 4–5 hrs | History tab      | `git log`            | `checkpointPanel.js` |
| 6.4 | Restore to Checkpoint    | 2–3 hrs | Restore button   | `git checkout`       | —                    |
| 6.5 | Diff View                | 3–4 hrs | Diff modal       | `git diff`           | `diffViewer.js`      |
| 6.6 | Checkpoint Labels        | 1–2 hrs | Inline edit      | Git tags/notes       | —                    |
| 6.7 | Auto-Save                | 2–3 hrs | Status indicator | File write           | `autoSave.js`        |
| 6.8 | Settings Panel           | 5–7 hrs | Modal/page       | —                    | `settings.js`        |

**Total estimated effort**: 20–28 hours

---

## Implementation Order

```
Group A — Git Foundation
  6.1 (auto-init) → 6.2 (manual checkpoint)

Group B — History & Restore
  6.3 (history panel) → 6.4 (restore) → 6.6 (labels)

Group C — Diff
  6.5 (diff view)

Group D — Auto-Save & Settings
  6.7 (auto-save) → 6.8 (settings panel)
```

**Rationale**:

- Git init (6.1) must come first — everything else depends on a repo existing
- Manual checkpoint (6.2) establishes the commit pattern
- History (6.3) + restore (6.4) are tightly coupled — build together
- Diff (6.5) needs history to select checkpoints from
- Auto-save (6.7) and settings (6.8) are independent subsystems

---

## Key Design Decisions

### Why Git for Checkpoints?

We considered several approaches:

| Approach                     | Pros                                                                     | Cons                                         |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| **Git**                      | Battle-tested, diff built-in, branching for free, users can also use CLI | Requires Git installed on machine            |
| Copy-on-save (zip snapshots) | Simple, no deps                                                          | No diff, slow for large projects, disk heavy |
| SQLite journal               | Fast, structured                                                         | No diff, custom format, fragile              |

**Decision**: Git. It's ubiquitous (required for many dev tools anyway), and `simple-git` abstracts the CLI perfectly. The user never sees Git — SolteX handles all operations through the API.

### Checkpoints vs. Auto-Save

These are intentionally separate concepts:

- **Auto-save** (6.7): Writes the current editor content to disk every N seconds. No commit. Prevents data loss from crashes.
- **Checkpoint** (6.2): An explicit user action that creates a Git commit. Represents a meaningful state the user wants to remember.

Auto-save does NOT create checkpoints. The user must explicitly click "Save Checkpoint" or press `Ctrl+S`.

### Settings Storage: Two Layers

1. **Global settings** → `localStorage` in the browser. Survives across projects.
2. **Per-project overrides** → `project.json` (e.g., `texEngine: "xelatex"`). Stored in the project directory.

Priority: project-level overrides > global settings > defaults.

### `.gitignore` for Project Repos

Each project's Git repo gets a `.gitignore`:

```
output/
*.aux
*.log
*.toc
*.bbl
*.blg
*.out
*.synctex.gz
*.fls
*.fdb_latexmk
_draft_wrapper.tex
```

This prevents compilation artifacts from being committed.

---

## Phase 6 Integration Test Plan

### Full Workflow

1. Create a new project → `.git/` directory exists (hidden from file tree)
2. Edit `main.tex` → click "Save Checkpoint" → checkpoint created
3. Open History tab (🕐) → one checkpoint visible with timestamp
4. Edit `main.tex` again → save another checkpoint → history shows two entries
5. Click checkpoint #1 → "Restore" → document reverts to first version
6. Verify: current state was auto-checkpointed before restore
7. History now shows 3 entries (original, edit, auto-save-before-restore)
8. Select checkpoints #1 and #2 → "Compare" → diff modal shows changes
9. Diff highlights added lines (green) and removed lines (red)
10. Edit label on checkpoint #1 → rename to "Initial draft"
11. Label appears in history panel
12. Type in editor → wait 5 seconds → status bar shows "Auto-saved"
13. Close browser → reopen → auto-saved content is preserved (but no new checkpoint)
14. Open Settings → change font size to 18px → editor updates immediately
15. Change TeX engine to XeLaTeX → next compile uses `xelatex`
16. Change keybinding mode to Vim → editor enters Vim mode
17. Toggle word wrap → editor wraps/unwraps lines
18. Close and reopen → settings persist

### Edge Cases

1. Project with no checkpoints → history panel shows "No checkpoints yet"
2. Restore on a project with unsaved changes → auto-checkpoint first
3. Diff between first checkpoint and working tree → shows all changes since
4. Git not installed on system → checkpoint features gracefully disabled with message
5. Settings: invalid font size (e.g., 0) → rejected, kept at previous
6. Auto-save fires during compile → no conflict (file write is atomic)
7. Very large diff (1000+ changed lines) → `diff2html` handles it

---

> **Phase 6 is complete when all integration tests pass.**
>
> Next: Proceed to Phase 7 (Polish, Performance & UX).

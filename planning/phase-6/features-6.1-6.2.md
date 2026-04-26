# Features 6.1, 6.2 — Git Auto-Init & Manual Checkpoint

> **Phase**: 6 | **Features**: 1, 2
> **Goal**: (6.1) Auto-initialize a Git repo when a project is created. (6.2) "Save Checkpoint" button that commits all changes with a timestamp message.
> **Estimated Effort**: 3 hours total
> **Dependencies**: Feature 4.2 (project creation). Requires Git installed on the system.

---

## Step 1: Git Manager Utility

### File: `server/utils/gitManager.js`

A centralized module that wraps all Git operations. Every other feature in Phase 6 uses this.

```javascript
// server/utils/gitManager.js
import simpleGit from "simple-git";
import fs from "fs/promises";
import path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "projects");

// Project .gitignore content
const PROJECT_GITIGNORE = `# SolteX — auto-generated
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
project.json
`;

/**
 * Get a simple-git instance for a project.
 */
function getGit(projectSlug) {
  const projectDir = path.resolve(PROJECTS_DIR, projectSlug);
  return simpleGit(projectDir);
}

/**
 * Initialize a Git repo in a project directory.
 * Called when a project is created.
 */
export async function initRepo(projectSlug) {
  const projectDir = path.resolve(PROJECTS_DIR, projectSlug);

  try {
    const git = getGit(projectSlug);
    await git.init();

    // Write .gitignore
    const gitignorePath = path.join(projectDir, ".gitignore");
    await fs.writeFile(gitignorePath, PROJECT_GITIGNORE, "utf-8");

    // Initial commit
    await git.add("-A");
    await git.commit("Initial project creation");

    console.log(`Git initialized for project: ${projectSlug}`);
    return true;
  } catch (err) {
    console.error(`Git init failed for ${projectSlug}:`, err);
    return false;
  }
}

/**
 * Create a checkpoint (commit all changes).
 * @param {string} projectSlug
 * @param {string} label - Optional user label
 * @returns {{ hash, message, date } | null}
 */
export async function createCheckpoint(projectSlug, label = "") {
  try {
    const git = getGit(projectSlug);

    // Stage all changes
    await git.add("-A");

    // Check if there are changes to commit
    const status = await git.status();
    if (status.isClean()) {
      return { skipped: true, reason: "No changes to save" };
    }

    // Build commit message
    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const message = label
      ? `${label} (${timestamp})`
      : `Checkpoint: ${timestamp}`;

    const result = await git.commit(message);
    console.log(`Checkpoint created: ${result.commit}`);

    return {
      hash: result.commit,
      message,
      date: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Checkpoint failed for ${projectSlug}:`, err);
    return null;
  }
}

/**
 * Get checkpoint history (git log).
 * @returns {Array<{ hash, message, date, filesChanged }>}
 */
export async function getCheckpoints(projectSlug, maxCount = 50) {
  try {
    const git = getGit(projectSlug);
    const log = await git.log({ maxCount, "--stat": null });

    return log.all.map((entry) => ({
      hash: entry.hash,
      hashShort: entry.hash.substring(0, 7),
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
      // Parse --stat output for file count
      filesChanged: parseStatSummary(entry.diff),
    }));
  } catch (err) {
    console.error(`Log failed for ${projectSlug}:`, err);
    return [];
  }
}

/**
 * Parse the diff stat summary for a more readable output.
 */
function parseStatSummary(diff) {
  if (!diff) return { changed: 0, insertions: 0, deletions: 0 };
  return {
    changed: diff.changed || 0,
    insertions: diff.insertions || 0,
    deletions: diff.deletions || 0,
  };
}

/**
 * Restore project to a specific checkpoint.
 * Auto-saves current state first.
 */
export async function restoreCheckpoint(projectSlug, targetHash) {
  try {
    const git = getGit(projectSlug);

    // Auto-save current state before restoring
    await git.add("-A");
    const status = await git.status();
    if (!status.isClean()) {
      const timestamp = new Date().toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      await git.commit(`Auto-save before restore (${timestamp})`);
    }

    // Restore: checkout all files from the target commit
    await git.checkout([targetHash, "--", "."]);

    console.log(`Restored ${projectSlug} to ${targetHash}`);
    return true;
  } catch (err) {
    console.error(`Restore failed for ${projectSlug}:`, err);
    return false;
  }
}

/**
 * Get diff between two commits (or working tree).
 * @param {string} from - Commit hash (or empty for first commit)
 * @param {string} to - Commit hash (or 'HEAD' for latest)
 * @returns {string} - Unified diff output
 */
export async function getDiff(projectSlug, from, to) {
  try {
    const git = getGit(projectSlug);
    const diff = await git.diff([from, to]);
    return diff;
  } catch (err) {
    console.error(`Diff failed for ${projectSlug}:`, err);
    return "";
  }
}

/**
 * Update a checkpoint's label using git notes.
 */
export async function updateLabel(projectSlug, hash, label) {
  try {
    const git = getGit(projectSlug);
    await git.raw(["notes", "add", "-f", "-m", label, hash]);
    return true;
  } catch (err) {
    console.error(`Label update failed:`, err);
    return false;
  }
}

/**
 * Check if Git is available on this system.
 */
export async function isGitAvailable() {
  try {
    const git = simpleGit();
    await git.version();
    return true;
  } catch {
    return false;
  }
}

export { getGit };
```

---

## Step 2: Checkpoint API Routes

### File: `server/routes/checkpoints.js`

```javascript
// server/routes/checkpoints.js
import express from "express";
import {
  createCheckpoint,
  getCheckpoints,
  restoreCheckpoint,
  getDiff,
  updateLabel,
  isGitAvailable,
} from "../utils/gitManager.js";

const router = express.Router();

/**
 * POST /api/projects/:project/checkpoint
 * Body: { label?: string }
 */
router.post("/:project/checkpoint", async (req, res) => {
  const { project } = req.params;
  const { label } = req.body || {};

  const result = await createCheckpoint(project, label);
  if (!result) return res.status(500).json({ error: "Checkpoint failed" });
  if (result.skipped) return res.json({ skipped: true, reason: result.reason });

  res.status(201).json(result);
});

/**
 * GET /api/projects/:project/checkpoints
 */
router.get("/:project/checkpoints", async (req, res) => {
  const { project } = req.params;
  const checkpoints = await getCheckpoints(project);
  res.json({ checkpoints });
});

/**
 * POST /api/projects/:project/restore
 * Body: { hash: string }
 */
router.post("/:project/restore", async (req, res) => {
  const { project } = req.params;
  const { hash } = req.body;

  if (!hash) return res.status(400).json({ error: "Missing hash" });

  const success = await restoreCheckpoint(project, hash);
  if (!success) return res.status(500).json({ error: "Restore failed" });

  res.json({ success: true });
});

/**
 * GET /api/projects/:project/diff
 * Query: { from, to }
 */
router.get("/:project/diff", async (req, res) => {
  const { project } = req.params;
  const { from, to } = req.query;

  if (!from || !to)
    return res.status(400).json({ error: "Missing from/to hashes" });

  const diff = await getDiff(project, from, to);
  res.json({ diff });
});

/**
 * PUT /api/projects/:project/checkpoint/:hash
 * Body: { label: string }
 */
router.put("/:project/checkpoint/:hash", async (req, res) => {
  const { project, hash } = req.params;
  const { label } = req.body;

  if (!label) return res.status(400).json({ error: "Missing label" });

  const success = await updateLabel(project, hash, label);
  if (!success) return res.status(500).json({ error: "Label update failed" });

  res.json({ success: true });
});

/**
 * GET /api/git/status
 * Check if Git is available on the system.
 */
router.get("/git/status", async (req, res) => {
  const available = await isGitAvailable();
  res.json({ available });
});

export default router;
```

---

## Step 3: Wire Git Init to Project Creation

In `server/routes/projects.js`, add after project directory creation:

```javascript
import { initRepo } from "../utils/gitManager.js";

// In POST /api/projects — after creating main.tex and project.json:
await initRepo(slug);
```

---

## Step 4: Frontend — Save Checkpoint Button

### HTML (in toolbar)

```html
<button
  id="btn-checkpoint"
  class="btn btn-toolbar"
  title="Save Checkpoint (Ctrl+S)"
>
  <span class="btn-icon">💾</span>
  <span class="btn-text">Save</span>
</button>
```

### JavaScript

```javascript
// In app.js:
document
  .getElementById("btn-checkpoint")
  .addEventListener("click", saveCheckpoint);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveCheckpoint();
  }
});

async function saveCheckpoint() {
  const btn = document.getElementById("btn-checkpoint");
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Saving...";

  try {
    // First, save current file content to disk
    await saveCurrentFileToDisk();

    const response = await fetch(`/api/projects/${currentProject}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();

    if (data.skipped) {
      showToast("No changes to save", "info");
    } else {
      showToast("Checkpoint saved", "success");
      // Refresh history panel if open
      document.dispatchEvent(new CustomEvent("checkpoint-saved"));
    }
  } catch (err) {
    showToast("Failed to save checkpoint", "error");
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Save";
  }
}
```

---

## Edge Cases

- **Git not installed**: `isGitAvailable()` returns false. Checkpoint buttons are disabled with a tooltip "Git not installed".
- **No changes**: If the user clicks "Save" but nothing changed, show "No changes to save" — don't create an empty commit.
- **First checkpoint**: After project creation, there's already an initial commit. The first user checkpoint is the second commit.
- **`.gitignore`**: Prevents `output/`, `.aux`, etc. from being committed. Only source files are tracked.
- **`project.json` in .gitignore**: We include it in `.gitignore` because it contains metadata that changes often (like `updatedAt`), which would create noisy commits. The user's source files are what matters.

---

## Final Checklist

| #   | Check                                            | Status |
| --- | ------------------------------------------------ | ------ |
| 1   | New project → `.git/` directory created          | ☐      |
| 2   | `.git` hidden from file tree                     | ☐      |
| 3   | `.gitignore` excludes output and aux files       | ☐      |
| 4   | Initial commit exists after project creation     | ☐      |
| 5   | "Save Checkpoint" button creates a commit        | ☐      |
| 6   | `Ctrl+S` triggers checkpoint save                | ☐      |
| 7   | No changes → "No changes to save" message        | ☐      |
| 8   | Commit message includes timestamp                | ☐      |
| 9   | Git not installed → checkpoint features disabled | ☐      |

> **Done → Proceed to Features 6.3–6.6.**

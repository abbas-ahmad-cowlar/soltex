# Feature 4.2 — Create New Project

> **Phase**: 4 | **Feature**: 2 of 11
> **Goal**: Allow creating a blank project or one from a starter template. Scaffolds a directory with `main.tex`, `project.json`, and `output/`.
> **Estimated Effort**: 2–3 hours
> **Dependencies**: Feature 4.1 (projects API route file, dashboard UI).

---

## Step 1: Backend — Create Project Endpoint

Add to `server/routes/projects.js`:

```javascript
/**
 * POST /api/projects
 * Body: { name: string, template?: string }
 * Creates a new project directory with scaffolded files.
 */
router.post('/', async (req, res) => {
  const { name, template } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Sanitize name → slug (URL-safe directory name)
  const slug = name.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .substring(0, 64);              // max 64 chars

  if (!slug) {
    return res.status(400).json({ error: 'Invalid project name' });
  }

  const projectDir = path.join(PROJECTS_DIR, slug);

  // Check if already exists
  try {
    await fs.access(projectDir);
    return res.status(409).json({ error: 'A project with this name already exists' });
  } catch {
    // Directory doesn't exist — good, proceed
  }

  try {
    // Create directory structure
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'output'), { recursive: true });

    // Create project.json
    const metadata = {
      name: name.trim(),
      mainFile: 'main.tex',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      archived: false,
    };
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(metadata, null, 2), 'utf-8'
    );

    // Create main.tex (from template or blank)
    let mainContent;
    if (template) {
      const templateDir = path.resolve(process.cwd(), 'templates', template);
      if (templateDir.startsWith(path.resolve(process.cwd(), 'templates'))) {
        try {
          mainContent = await fs.readFile(path.join(templateDir, 'main.tex'), 'utf-8');
        } catch {
          mainContent = getBlankTemplate();
        }
      } else {
        mainContent = getBlankTemplate();
      }
    } else {
      mainContent = getBlankTemplate();
    }

    await fs.writeFile(path.join(projectDir, 'main.tex'), mainContent, 'utf-8');

    res.status(201).json({ slug, name: name.trim() });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

function getBlankTemplate() {
  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{Untitled Document}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Start writing here.

\\end{document}
`;
}
```

---

## Step 2: Frontend — Wire the Modal

In `dashboard.js`, add the modal functions:

```javascript
function openNewProjectModal() {
  document.getElementById('new-project-modal').style.display = 'flex';
  const input = document.getElementById('new-project-name');
  input.value = '';
  document.getElementById('modal-error').style.display = 'none';
  requestAnimationFrame(() => input.focus());
}

function closeNewProjectModal() {
  document.getElementById('new-project-modal').style.display = 'none';
}

async function createProject() {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) return;

  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorEl = document.getElementById('modal-error');
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
      return;
    }

    // Navigate to the new project
    window.location.href = `/editor.html?project=${data.slug}`;
  } catch (err) {
    console.error('Failed to create project:', err);
  }
}
```

---

## Edge Cases

- **Duplicate name**: Backend returns 409 → modal shows error message
- **Special characters**: `My Thesis (v2) [Final]` → slug becomes `my-thesis-v2-final`
- **Empty name**: Rejected by backend validation
- **Template not found**: Falls back to blank template

---

## Final Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | "New Project" button opens modal | ☐ |
| 2 | Typing name + Enter creates project | ☐ |
| 3 | Project directory created with `main.tex`, `project.json`, `output/` | ☐ |
| 4 | `main.tex` has a sensible blank template | ☐ |
| 5 | After creation, navigates to editor with new project loaded | ☐ |
| 6 | Duplicate name shows error in modal | ☐ |
| 7 | Escape closes modal | ☐ |
| 8 | Special characters are sanitized in slug | ☐ |

> **Done → Proceed to Feature 4.3 (File Tree Sidebar).**

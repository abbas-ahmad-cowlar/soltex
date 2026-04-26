# Features 5.6, 5.8 — Template Library & Citation Autocomplete

> **Phase**: 5 | **Features**: 6, 8
> **Goal**: (5.6) A template browser for creating new projects from pre-built starters. (5.8) Autocomplete citation keys from `.bib` files when typing `\cite{`.
> **Estimated Effort**: 7–9 hours total
> **Dependencies**: Feature 4.2 (project creation), Feature 2.1 (autocomplete system).

---

## Feature 5.6 — Template Library

### Overview

Templates are stored as subdirectories in a `templates/` folder at the project root. Each template contains:
- `main.tex` — the starter document
- `template.json` — metadata (name, description, category)
- Any supporting files (`.bib`, `.sty`, images, etc.)

### Template Directory Structure
```
templates/
  ieee-paper/
    template.json
    main.tex
    IEEEtran.cls
  thesis/
    template.json
    main.tex
    chapters/
      introduction.tex
  beamer-presentation/
    template.json
    main.tex
  homework/
    template.json
    main.tex
  cv/
    template.json
    main.tex
  cover-letter/
    template.json
    main.tex
  lab-report/
    template.json
    main.tex
```

### `template.json` Schema
```json
{
  "name": "IEEE Conference Paper",
  "description": "Two-column IEEE format paper with abstract, sections, and references.",
  "category": "Academic",
  "icon": "📄"
}
```

---

### Step 1: Backend — List Templates

Add to `server/routes/projects.js`:

```javascript
const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

/**
 * GET /api/templates
 * Lists all available templates.
 */
router.get('/templates', async (req, res) => {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const templates = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(TEMPLATES_DIR, entry.name, 'template.json');

      try {
        const raw = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(raw);
        templates.push({
          slug: entry.name,
          name: meta.name || entry.name,
          description: meta.description || '',
          category: meta.category || 'General',
          icon: meta.icon || '📄',
        });
      } catch {
        templates.push({ slug: entry.name, name: entry.name, description: '', category: 'General', icon: '📄' });
      }
    }

    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list templates' });
  }
});
```

### Step 2: Update Project Creation to Support Templates

The existing `POST /api/projects` endpoint already accepts a `template` field (from Phase 4 Feature 4.2). Update it to copy the entire template directory, not just `main.tex`:

```javascript
// In POST /api/projects — replace the template handling:
if (template) {
  const templateDir = path.resolve(TEMPLATES_DIR, template);
  if (templateDir.startsWith(TEMPLATES_DIR)) {
    try {
      // Copy all template files (except template.json) into the new project
      await fs.cp(templateDir, projectDir, { recursive: true });
      // Remove template.json from the project (it's not a user file)
      await fs.rm(path.join(projectDir, 'template.json'), { force: true });
    } catch {
      // Fallback: create blank project
      await fs.writeFile(path.join(projectDir, 'main.tex'), getBlankTemplate(), 'utf-8');
    }
  }
} else {
  await fs.writeFile(path.join(projectDir, 'main.tex'), getBlankTemplate(), 'utf-8');
}
```

### Step 3: Frontend — Template Picker in Dashboard Modal

Update the "New Project" modal in `dashboard.html`:

```html
<div id="new-project-modal" class="modal-overlay" style="display: none;">
  <div class="modal-box modal-wide">
    <h2 class="modal-title">Create New Project</h2>

    <!-- Tab: Blank vs Template -->
    <div class="modal-tabs">
      <button class="modal-tab active" data-tab="blank">Blank Project</button>
      <button class="modal-tab" data-tab="template">From Template</button>
    </div>

    <!-- Blank tab -->
    <div id="tab-blank" class="modal-tab-content">
      <label class="dialog-label" for="new-project-name">Project Name</label>
      <input id="new-project-name" class="dialog-input" type="text" placeholder="e.g., My Thesis" />
    </div>

    <!-- Template tab -->
    <div id="tab-template" class="modal-tab-content" style="display: none;">
      <label class="dialog-label" for="template-project-name">Project Name</label>
      <input id="template-project-name" class="dialog-input" type="text" placeholder="e.g., My Paper" />
      <div id="template-grid" class="template-grid">
        <!-- Populated by JS -->
      </div>
    </div>

    <div class="modal-actions">
      <button id="modal-cancel" class="btn btn-ghost">Cancel</button>
      <button id="modal-create" class="btn btn-primary">Create</button>
    </div>
  </div>
</div>
```

### Template Grid JavaScript
```javascript
let selectedTemplate = null;

async function loadTemplates() {
  const response = await fetch('/api/templates');
  const data = await response.json();
  const grid = document.getElementById('template-grid');

  grid.innerHTML = data.templates.map(t => `
    <div class="template-card" data-slug="${t.slug}">
      <span class="template-icon">${t.icon}</span>
      <h4 class="template-name">${t.name}</h4>
      <p class="template-desc">${t.description}</p>
    </div>
  `).join('');

  grid.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTemplate = card.dataset.slug;
    });
  });
}

// In createProject():
async function createProject() {
  const activeTab = document.querySelector('.modal-tab.active').dataset.tab;
  const name = activeTab === 'blank'
    ? document.getElementById('new-project-name').value.trim()
    : document.getElementById('template-project-name').value.trim();

  if (!name) return;

  const body = { name };
  if (activeTab === 'template' && selectedTemplate) {
    body.template = selectedTemplate;
  }

  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // ... handle response
}
```

### Template Card CSS
```css
.modal-wide { min-width: 600px; max-width: 700px; }

.modal-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.modal-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.modal-tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 12px;
}

.template-card {
  background: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 16px 12px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.template-card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-1px);
}

.template-card.selected {
  border-color: var(--accent-primary);
  background: rgba(124, 111, 247, 0.1);
}

.template-icon { font-size: 28px; display: block; margin-bottom: 8px; }
.template-name { font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary); margin: 0; }
.template-desc { font-size: var(--font-size-xs); color: var(--text-placeholder); margin: 4px 0 0; }
```

---

## Feature 5.8 — Citation Key Autocomplete

### Overview

When the user types `\cite{`, show a dropdown of all citation keys from the project's `.bib` files with author, title, and year preview.

### Step 1: BibTeX Parser

### File: `src/js/bibParser.js`

```javascript
// src/js/bibParser.js

/**
 * Parse a .bib file and extract citation entries.
 * @param {string} bibContent - Raw content of a .bib file
 * @returns {Array<{ key, type, author, title, year }>}
 */
export function parseBibFile(bibContent) {
  const entries = [];
  // Match @type{key, ... }
  const entryRegex = /@(\w+)\{([^,]+),([^]*?)(?=\n@|\n*$)/g;
  let match;

  while ((match = entryRegex.exec(bibContent)) !== null) {
    const type = match[1].toLowerCase(); // article, book, inproceedings, etc.
    const key = match[2].trim();
    const body = match[3];

    if (type === 'comment' || type === 'string' || type === 'preamble') continue;

    entries.push({
      key,
      type,
      author: extractField(body, 'author'),
      title: extractField(body, 'title'),
      year: extractField(body, 'year'),
    });
  }

  return entries;
}

/**
 * Extract a field value from a BibTeX entry body.
 */
function extractField(body, fieldName) {
  // Match: fieldName = {value} or fieldName = "value"
  const regex = new RegExp(`${fieldName}\\s*=\\s*[{"]([^}"]*)[}"]`, 'i');
  const match = body.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Load and parse all .bib files in a project.
 */
export async function loadCitations(projectSlug) {
  try {
    // Get file tree
    const response = await fetch(`/api/projects/${projectSlug}/files`);
    const data = await response.json();
    const bibFiles = findBibFiles(data.tree);

    const allEntries = [];
    for (const bibPath of bibFiles) {
      const fileResponse = await fetch(
        `/api/projects/${projectSlug}/file?path=${encodeURIComponent(bibPath)}`
      );
      const fileData = await fileResponse.json();
      if (fileData.content) {
        const entries = parseBibFile(fileData.content);
        allEntries.push(...entries);
      }
    }

    return allEntries;
  } catch (err) {
    console.error('Failed to load citations:', err);
    return [];
  }
}

function findBibFiles(items, result = []) {
  for (const item of items) {
    if (item.type === 'file' && item.name.endsWith('.bib')) result.push(item.path);
    if (item.children) findBibFiles(item.children, result);
  }
  return result;
}
```

### Step 2: Add Citation Completions to Editor

In `latexCompletions.js`, add a citation completion source:

```javascript
import { loadCitations } from './bibParser.js';

let citationEntries = []; // Loaded on project open

/**
 * Load citations when the project opens.
 */
export async function initCitationCompletions(projectSlug) {
  citationEntries = await loadCitations(projectSlug);
  console.log(`Loaded ${citationEntries.length} citation entries`);
}

/**
 * Citation completion source — activates after \cite{
 */
function citationCompletionSource(context) {
  // Check if we're inside \cite{ ... }
  const beforeCursor = context.state.sliceDoc(
    Math.max(0, context.pos - 50), context.pos
  );

  // Match \cite{, \citep{, \citet{, \parencite{, etc.
  const citeMatch = beforeCursor.match(/\\(?:cite|citep|citet|parencite|textcite|autocite)\{([^}]*)$/);
  if (!citeMatch) return null;

  const prefix = citeMatch[1]; // What's been typed after \cite{
  const from = context.pos - prefix.length;

  const options = citationEntries
    .filter(e => e.key.toLowerCase().startsWith(prefix.toLowerCase()))
    .map(e => ({
      label: e.key,
      detail: `${e.author} (${e.year})`,
      info: e.title,
      type: 'text',
    }));

  return { from, options };
}
```

Add `citationCompletionSource` to the editor's autocompletion sources alongside the existing LaTeX completions.

---

## Edge Cases

### Template Library
- **No templates installed**: Template tab shows "No templates available. Add templates to the `templates/` directory."
- **Template missing `main.tex`**: Creation still works — the project just has whatever files the template has
- **Template with `template.json` errors**: Falls back to directory name

### Citation Autocomplete
- **No `.bib` files**: Citation array is empty. `\cite{` shows nothing — no crash.
- **Malformed `.bib` entries**: The regex parser is lenient. Unparseable entries are skipped.
- **Multiple `.bib` files**: All entries are merged. Duplicate keys show once.
- **Reloading after `.bib` edit**: Call `initCitationCompletions()` after saving a `.bib` file to refresh.

---

## Final Checklist — Features 5.6 & 5.8

| # | Check | Status |
|---|-------|--------|
| 1 | "From Template" tab in New Project modal | ☐ |
| 2 | Template grid shows all available templates | ☐ |
| 3 | Selecting a template highlights it (blue border) | ☐ |
| 4 | Creating from template copies all template files | ☐ |
| 5 | `template.json` is NOT included in the created project | ☐ |
| 6 | Template card shows icon, name, and description | ☐ |
| 7 | `\cite{` triggers citation key dropdown | ☐ |
| 8 | Completions show key, author, year, and title | ☐ |
| 9 | Selecting a citation inserts the key | ☐ |
| 10 | Multiple `.bib` files → all keys available | ☐ |
| 11 | Empty/missing `.bib` → no crash, no completions | ☐ |

> **Phase 5 is DONE when all feature checklists pass. Run the Phase 5 Integration Test Plan.**

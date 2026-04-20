# Phase 5 Blueprint — Search, Spell Check, Templates & Bibliography

> **Phase**: 5 of 7
> **Goal**: Add search capabilities (in-file and project-wide), spell checking, a template library, citation/bibliography support, and a document outline navigator. These features transform the editor from functional to genuinely productive.
> **Estimated Effort**: 2–3 weeks
> **Prerequisite**: Phases 1–4 are complete. The app has a multi-project dashboard, file tree, CRUD operations, and a working compilation pipeline.

---

## What Phase 5 Delivers

When Phase 5 is complete, the user should be able to:
1. **Find** text in the current file with `Ctrl+F` (highlighting, regex, case toggle)
2. **Find and Replace** with `Ctrl+H` (replace one / all)
3. **Search across all files** with `Ctrl+Shift+F` (results with file, line, context)
4. **Navigate the document structure** via an outline panel (sections, subsections)
5. **See spelling errors** underlined in real-time (LaTeX-aware — ignores commands)
6. **Browse templates** and create new projects from them (IEEE, thesis, Beamer, etc.)
7. **Compile with bibliography** support (BibTeX/Biber — already via latexmk)
8. **Autocomplete citation keys** from `.bib` files when typing `\cite{`
9. **See word count** in the status bar

**Key Insight**: This phase has a unique structure. Features 5.1–5.2 are **zero-code** (built into CodeMirror). Feature 5.7 is **already done** (latexmk handles bibtex). The real work is in 5.3 (project-wide search), 5.4 (outline), 5.5 (spell checker), 5.6 (template library), and 5.8 (citation autocomplete).

---

## Architecture Changes

### New Files
| File | Purpose |
|------|---------|
| `src/js/outlinePanel.js` | **[NEW]** Document structure navigator |
| `src/js/spellChecker.js` | **[NEW]** LaTeX-aware spell checking module |
| `src/js/templateLibrary.js` | **[NEW]** Template browser + project creation |
| `src/js/bibParser.js` | **[NEW]** BibTeX file parser for citation autocomplete |
| `server/routes/search.js` | **[NEW]** Project-wide search endpoint |
| `server/routes/wordcount.js` | **[NEW]** Word count endpoint |
| `templates/` | **[NEW]** Directory containing starter templates |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/js/editor.js` | Add CodeMirror `search` extension, spell check decorations |
| `src/js/latexCompletions.js` | Add citation key completion source |
| `src/index.html` | Add outline panel, search sidebar, template modal |
| `src/css/style.css` | Outline panel, spell checker, search results, template grid |
| `src/dashboard.html` | Add "From Template" option to project creation |
| `src/js/app.js` | Wire outline, spell checker, and search modules |

### Layout Change
Phase 5 adds a **switchable left panel** — the file tree sidebar becomes a tabbed panel:

```
┌──────────────────────────────────────────────────────────────────┐
│ Toolbar: [← Dashboard] [Compile] [Draft] [Logs] [Auto]  | zoom │
├──────────┬──────────────────────┬──┬─────────────────────────────┤
│ [📁][🔍][📑]                    │  │                             │
│ ──────────                     │  │                             │
│ Tab: Files │   Editor Panel    │▐▐│    PDF Preview Panel        │
│  or Search │   (CodeMirror)    │▐▐│    (pdf.js canvases)        │
│  or Outline│                   │  │                             │
│            │───────────────────┤  │                             │
│            │ Log Panel         │  │                             │
└────────────┴───────────────────┴──┴─────────────────────────────┘
```

The sidebar header gets 3 tabs:
- 📁 **Files** — the file tree (existing)
- 🔍 **Search** — project-wide search (new)
- 📑 **Outline** — document structure (new)

---

## Feature Summary Table

| # | Feature | Effort | Frontend | Backend | New Module? |
|---|---------|--------|----------|---------|-------------|
| 5.1 | Find in Current File | 10 min | ✅ (built-in) | — | — |
| 5.2 | Find and Replace | 10 min | ✅ (built-in) | — | — |
| 5.3 | Project-Wide Search | 4–6 hrs | Search panel | Search endpoint | `search.js` (server) |
| 5.4 | Document Outline | 3–4 hrs | Outline panel | — | `outlinePanel.js` |
| 5.5 | Spell Checker | 6–8 hrs | Decorations | — | `spellChecker.js` |
| 5.6 | Template Library | 4–5 hrs | Template modal | Template listing | `templateLibrary.js` |
| 5.7 | BibTeX/Biber Support | 0 min | — | Already done | — |
| 5.8 | Citation Autocomplete | 3–4 hrs | Completion source | — | `bibParser.js` |
| 5.9 | Word Count | 1–2 hrs | Status bar | texcount endpoint | `wordcount.js` (server) |

**Total estimated effort**: 22–30 hours

---

## Implementation Order

```
Group A — Zero-Code (just enable built-in extensions)
  5.1 → 5.2 → 5.7

Group B — Editor Enhancements
  5.4 (outline) → 5.9 (word count)

Group C — Search
  5.3 (project-wide search)

Group D — Spell Checking
  5.5 (spell checker)

Group E — Templates & Bibliography
  5.6 (template library) → 5.8 (citation autocomplete)
```

**Rationale**:
- Start with the freebies (5.1, 5.2, 5.7 — literally adding imports)
- Outline (5.4) is a self-contained frontend-only panel, easy early win
- Project-wide search (5.3) needs a backend endpoint but reuses the sidebar pattern
- Spell checker (5.5) is the most complex — requires `typo.js`, LaTeX filtering, and CodeMirror decorations
- Templates (5.6) and citations (5.8) are independent features that build on Phase 4's project creation flow

---

## Features 5.1, 5.2, 5.7 — Already Done / Zero-Code

### 5.1 & 5.2 — Find and Find & Replace
**Status**: Already available via CodeMirror 6's `@codemirror/search` extension.
**What to do**: Ensure the `search()` extension is in the editor's extensions array:
```javascript
import { search, searchKeymap } from '@codemirror/search';

// In extensions array:
search(),
keymap.of(searchKeymap),
```

This gives us:
- `Ctrl+F` → find bar with highlighting
- `Ctrl+H` → find + replace bar
- `Ctrl+G` → find next
- `Ctrl+Shift+G` → find previous
- Case sensitivity toggle, regex toggle, whole-word toggle

**CSS**: Style the search panel to match our dark theme:
```css
.cm-search {
  background: var(--bg-tertiary) !important;
  border-bottom: 1px solid var(--border-color) !important;
}
.cm-search input {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-color) !important;
}
.cm-search button {
  background: var(--bg-secondary) !important;
  color: var(--text-secondary) !important;
}
.cm-searchMatch { background: rgba(255, 214, 0, 0.3) !important; }
.cm-searchMatch-selected { background: rgba(255, 214, 0, 0.6) !important; }
```

### 5.7 — BibTeX / Biber Support
**Status**: Already done. `latexmk` automatically detects `.bib` files and runs `bibtex` or `biber` as needed. No code changes required.
**Verify**: Compile a document with `\bibliography{refs}` or `\addbibresource{refs.bib}` → check that references resolve correctly.

### Combined Checklist for 5.1, 5.2, 5.7

| # | Check | Status |
|---|-------|--------|
| 1 | `Ctrl+F` opens the find bar | ☐ |
| 2 | `Ctrl+H` opens find + replace | ☐ |
| 3 | Matches are highlighted in yellow | ☐ |
| 4 | Case-sensitivity toggle works | ☐ |
| 5 | Regex search works | ☐ |
| 6 | Replace one / Replace all works | ☐ |
| 7 | Search bar matches dark theme | ☐ |
| 8 | `latexmk` resolves `\cite{}` references automatically | ☐ |

---

## Feature 5.3 — Project-Wide Search (Summary)
**Scope**: `Ctrl+Shift+F` opens a search panel in the sidebar. User types a query → backend scans all text files in the project → returns results with file name, line number, and context snippet. Each result is clickable → opens the file and jumps to the line.
**Key Points**: Backend uses `child_process` to run `grep -rn` (or a Node.js equivalent like `fs.readFile` + string search). Results are paginated or limited to 200 matches. Frontend renders results in the sidebar's "Search" tab.

## Feature 5.4 — Document Outline (Summary)
**Scope**: A panel in the sidebar's "Outline" tab showing the document hierarchy (`\chapter`, `\section`, `\subsection`, etc.) as a clickable tree. Auto-updates when the document changes.
**Key Points**: Purely frontend. Regex-parse the current editor content for `\section{...}`, `\subsection{...}`, etc. Render as a nested list with indentation by level. Clicking an entry scrolls the editor to that line.

## Feature 5.5 — Integrated Spell Checker (Summary)
**Scope**: Wavy red underlines on misspelled words in the editor. LaTeX-aware (ignores commands, environments, math mode). Multi-language support. Right-click suggestions.
**Key Points**: Uses `typo.js` (Hunspell dictionaries in JavaScript). A CodeMirror `ViewPlugin` that tokenizes visible text, strips LaTeX commands, checks each word, and applies `Decoration.mark` for misspelled words. Heaviest feature of Phase 5.

## Feature 5.6 — Template Library (Summary)
**Scope**: A collection of starter templates. When creating a new project, user can choose "From Template" and browse options (IEEE paper, thesis, Beamer, homework, CV, cover letter, lab report). Each template has a preview screenshot and description.
**Key Points**: Templates are stored as directories in `templates/`. Backend lists available templates. Frontend shows a grid of template cards in the "New Project" modal. Creating from template copies the template directory into the new project.

## Feature 5.8 — Citation Key Autocomplete (Summary)
**Scope**: When typing `\cite{`, show a dropdown of all citation keys from the project's `.bib` files, with author/title/year preview.
**Key Points**: On project load, parse all `.bib` files to extract `@article{key, author={...}, title={...}, year={...}}` entries. Feed these into the existing `latexCompletionSource` as a context-specific completion (similar to how environments complete after `\begin{}`).

## Feature 5.9 — Word Count (Summary)
**Scope**: Display word count in the editor status bar. Updated on save or on demand.
**Key Points**: Backend runs `texcount main.tex` (installed with TeX Live). Returns word count. Frontend displays in a status bar element: `Words: 2,341`. If `texcount` is not available, fall back to a naive regex count (split by whitespace, exclude commands).

---

## Phase 5 Integration Test Plan

### Full Workflow
1. Open a project with `main.tex` + `refs.bib`
2. `Ctrl+F` → find bar opens → search for "section" → matches highlighted
3. `Ctrl+H` → replace "section" with "part" in one match → undo
4. `Ctrl+Shift+F` → sidebar switches to Search tab → type "equation" → results show across all `.tex` files
5. Click a search result → correct file opens, cursor jumps to line
6. Switch to Outline tab → see `\section`, `\subsection` hierarchy
7. Click a section in outline → editor scrolls to that line
8. Type a word like "teh" → wavy red underline appears
9. Right-click "teh" → suggestion "the" appears → click to fix
10. Type `\textbf{teh}` → only "teh" is underlined, not `\textbf`
11. Type `$E=mc^2$` → nothing underlined (math mode ignored)
12. Dashboard → "New Project" → "From Template" → browse templates → select "IEEE Paper" → project created with full template
13. Type `\cite{` → dropdown shows citation keys from `refs.bib`
14. Select a key → `\cite{einstein1905}` inserted
15. Compile → references resolve correctly
16. Status bar shows word count

### Edge Cases
1. Project-wide search with no results → "No results found" message
2. Search with regex → special characters handled correctly
3. Spell checker + Vim mode → underlines still appear in normal mode
4. Empty `.bib` file → no citation completions, no crash
5. Template with missing files → graceful error
6. Word count on empty document → "Words: 0"

---

> **Phase 5 is complete when all integration tests pass.**
>
> Next: Proceed to Phase 6 (Checkpoints & Settings).

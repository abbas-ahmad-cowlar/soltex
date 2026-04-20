# Phase 7 Blueprint — Polish, Performance & UX

> **Phase**: 7 of 7 (Final)
> **Goal**: Final polish pass. Make every interaction feel smooth, fast, and premium. Fix edge cases. Add keyboard shortcuts, themes, responsive layout, loading states, and PDF navigation. This is the phase that transforms SolteX from "functional" to "delightful".
> **Estimated Effort**: 1–2 weeks
> **Prerequisite**: Phases 1–6 complete. All core features are working.

---

## What Phase 7 Delivers

When Phase 7 is complete, the user should experience:

1. A complete **keyboard shortcuts system** with a cheat sheet dialog
2. **Per-project TeX engine** selection (pdfLaTeX/XeLaTeX/LuaLaTeX)
3. Multiple **editor color themes** beyond dark (Monokai, Dracula, Solarized, etc.)
4. **SVG file-type icons** in the file tree (replacing emoji)
5. **Image preview on hover** in the file tree
6. **Cursor position** in the status bar (`Ln 42, Col 15`)
7. Full **PDF page navigation** (page counter, go-to-page, prev/next)
8. **PDF text selection & copy**
9. A **responsive layout** that works on tablets and narrow screens
10. **Loading states** — spinners, skeleton loaders, progress indicators
11. **Print PDF** button

**Key Insight**: This phase is purely additive — no architectural changes. Every feature is a self-contained enhancement. They can be built in any order and none depend on each other.

---

## Architecture Changes

### New Files

| File                  | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `src/js/shortcuts.js` | **[NEW]** Central keyboard shortcut registry + help dialog |
| `src/js/themes.js`    | **[NEW]** Editor theme manager                             |
| `src/css/themes/`     | **[NEW]** Directory of CodeMirror theme CSS files          |
| `src/assets/icons/`   | **[NEW]** SVG file-type icons                              |

### Modified Files

| File                       | What Changes                                           |
| -------------------------- | ------------------------------------------------------ |
| `src/js/fileTree.js`       | Replace emoji icons with SVGs, add image hover preview |
| `src/js/pdfViewer.js`      | Add page navigation toolbar, text layer, print         |
| `src/js/editor.js`         | Export cursor position updates, theme compartment      |
| `src/js/app.js`            | Wire shortcuts system, loading states                  |
| `src/js/compiler.js`       | Add compilation spinner/progress                       |
| `src/css/style.css`        | Responsive media queries, loading animations           |
| `src/index.html`           | PDF toolbar, shortcuts modal, loading skeletons        |
| `server/routes/compile.js` | Read per-project `texEngine` from `project.json`       |

### No New Backend Routes

Phase 7 is almost entirely frontend. The only backend change is reading `texEngine` from `project.json` during compilation.

---

## Feature Summary Table

| #    | Feature                       | Effort  | Type           | Complexity |
| ---- | ----------------------------- | ------- | -------------- | ---------- |
| 7.1  | Keyboard Shortcuts System     | 3–4 hrs | Frontend       | Medium     |
| 7.2  | Per-Project TeX Engine        | 1–2 hrs | Full-stack     | Low        |
| 7.3  | Multiple Editor Themes        | 3–4 hrs | Frontend       | Medium     |
| 7.4  | File Type SVG Icons           | 2–3 hrs | Frontend       | Low        |
| 7.5  | Image Preview on Hover        | 2–3 hrs | Frontend       | Medium     |
| 7.6  | Cursor Position in Status Bar | 30 min  | Frontend       | Trivial    |
| 7.7  | PDF Page Navigation           | 2–3 hrs | Frontend       | Medium     |
| 7.8  | PDF Text Selection & Copy     | 30 min  | Frontend       | Trivial    |
| 7.9  | Responsive Layout             | 3–4 hrs | CSS            | Medium     |
| 7.10 | Loading States & Progress     | 3–4 hrs | Frontend + CSS | Medium     |
| 7.11 | Print PDF                     | 30 min  | Frontend       | Trivial    |

**Total estimated effort**: 22–30 hours

---

## Implementation Order

```
Group A — Quick Wins (trivial, < 1 hr each)
  7.6 (cursor position) → 7.8 (PDF text select) → 7.11 (print)

Group B — Editor Polish
  7.3 (themes) → 7.1 (keyboard shortcuts)

Group C — File Tree Polish
  7.4 (SVG icons) → 7.5 (image hover preview)

Group D — PDF Polish
  7.7 (page navigation)

Group E — UX Polish
  7.10 (loading states) → 7.9 (responsive layout)

Group F — Backend Touch
  7.2 (per-project TeX engine)
```

**Rationale**:

- Start with the trivial wins — immediate visible improvement for almost no effort
- Themes (7.3) before shortcuts (7.1) because themes change the overall feel
- SVG icons (7.4) before hover preview (7.5) because preview relies on the icon renderer
- Loading states (7.10) before responsive (7.9) because responsive is the final "fit and finish"
- TeX engine (7.2) is standalone — can be slotted anywhere

---

## Key Design Decisions

### Shortcuts Registry Pattern

Rather than scattering `addEventListener('keydown')` calls everywhere, Phase 7 introduces a **central shortcuts registry**. All shortcuts across all modules register through a single API. This enables:

- The help dialog to list every shortcut automatically
- Conflict detection (two features can't share the same key combo)
- Easy customization in future (user-configurable shortcuts)

### Theme Architecture

CodeMirror 6 uses a **Compartment** for dynamic theme switching. We create a theme compartment and swap its content when the user changes themes. All theme CSS is applied through CodeMirror's `EditorView.theme()` — no global CSS overrides needed.

### SVG Icons vs. Emoji

Phase 4 used emoji for file type icons (📝, 📚, 🖼️). Phase 7 replaces them with proper SVGs because:

- Emojis render differently across platforms (Windows vs Mac vs Linux)
- SVGs can be styled with CSS (color, size)
- SVGs look sharper at all sizes
- Professional appearance

---

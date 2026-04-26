<h1 align="center">
  SolteX
</h1>

<p align="center">
  <strong>A local-first, open-source LaTeX editor with live PDF preview.</strong><br>
  No cloud. No accounts. No limits. Just you and your documents.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
  <img src="https://img.shields.io/badge/node-18%2B-green" alt="Node 18+">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
</p>

---

## Why SolteX?

Most LaTeX editors are either cloud-locked (Overleaf), bloated (TeXstudio), or terminal-only. SolteX is a **lightweight, browser-based editor** that runs entirely on your machine -- your files stay on disk, compilation happens locally, and the interface feels like a modern IDE.

**Built for researchers, students, and anyone who writes LaTeX.**

---

## Features

### Editor
- **CodeMirror 6** with full LaTeX syntax highlighting
- **Autocomplete** for 200+ LaTeX commands and environments
- **Bracket matching**, code folding, and go-to-line
- **Vim and Emacs** keybinding modes
- **5 dark themes** (One Dark, Dracula, Nord, Monokai, Solarized)
- **Find & Replace** with regex support (Ctrl+H)

### Compilation
- **One-click compile** or Ctrl+S / Ctrl+Enter
- **Auto-compile** on edit with configurable debounce
- **Draft mode** for faster builds (skips images)
- **Structured error log** with clickable line numbers
- **Per-project TeX engine selection** (pdflatex, xelatex, lualatex)

### PDF Preview
- **Live PDF preview** with page-by-page rendering (PDF.js)
- **Zoom controls** (fit-width, fit-page, manual percentage)
- **Resizable split panel** between editor and preview

### Project Management
- **Multi-project dashboard** with create, rename, delete
- **Template library** (IEEE paper, thesis, Beamer, homework)
- **File tree sidebar** with drag-drop upload
- **File toolbar** -- new file, new folder, upload, import ZIP, open in Explorer
- **Project-wide search** with debounced input

### Version History
- **Git-backed checkpoints** -- create, restore, and diff snapshots
- **Per-project isolated history** (each project gets its own `.git`)

### Settings & UX
- **Persistent settings** (font size, tab width, word wrap, keybindings)
- **Auto-save** with configurable interval
- **Keyboard shortcuts dialog** (Ctrl+/)
- **Document outline** navigator (sections, subsections)
- **Word count** via texcount

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Editor | CodeMirror 6 |
| PDF | PDF.js |
| Frontend | Vanilla JS + Vite |
| Backend | Express 5 (Node.js) |
| Compiler | latexmk (MiKTeX / TeX Live) |
| Version Control | simple-git |
| Styling | Pure CSS (no frameworks) |

---

## Getting Started

### Prerequisites

| Requirement | Install |
|------------|---------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org/) |
| **MiKTeX** (Windows) | [miktex.org](https://miktex.org/) |
| **TeX Live** (macOS/Linux) | [tug.org/texlive](https://tug.org/texlive/) |
| **Git** | [git-scm.com](https://git-scm.com/) (for checkpoints) |

### Install & Run

```bash
git clone https://github.com/abbas-ahmad-cowlar/soltex.git
cd soltex
npm install
npm run dev
```

This starts:
- **Frontend** on [http://localhost:3000](http://localhost:3000) (Vite dev server)
- **Backend** on [http://localhost:3001](http://localhost:3001) (Express API)

Open [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html) to get started.

### One-Click Launch (Windows)

Double-click `soltex.vbs` to start the server silently and open the app in your browser. Create a desktop shortcut for instant access.

---

## Project Structure

```
soltex/
├── server/
│   ├── index.js              # Express entry point
│   ├── routes/
│   │   ├── compile.js         # POST /api/compile
│   │   ├── files.js           # File CRUD, upload, ZIP import
│   │   ├── projects.js        # Project + template management
│   │   ├── checkpoints.js     # Git checkpoint API
│   │   ├── search.js          # Project-wide search
│   │   └── wordcount.js       # Word count endpoint
│   └── utils/
│       ├── latex.js            # latexmk wrapper
│       └── gitManager.js       # Per-project git operations
├── src/
│   ├── index.html             # Editor page
│   ├── dashboard.html         # Project dashboard
│   ├── css/
│   │   ├── style.css          # Editor design system (1400+ lines)
│   │   └── dashboard.css      # Dashboard styles
│   └── js/
│       ├── app.js             # Main entry, wires all modules
│       ├── editor.js          # CodeMirror setup
│       ├── compiler.js        # Compile button logic
│       ├── pdfViewer.js       # PDF.js rendering
│       ├── fileTree.js        # Sidebar file tree + toolbar
│       ├── searchPanel.js     # Project search UI
│       ├── outlinePanel.js    # Document outline
│       ├── checkpointPanel.js # Version history UI
│       ├── settings.js        # Settings modal
│       ├── themes.js          # Editor theme switcher
│       ├── shortcuts.js       # Keyboard shortcut registry
│       └── ...
├── templates/                 # Project templates
├── projects/                  # User project data (gitignored)
├── planning/                  # Architecture docs & specs
├── soltex.bat                 # Windows launcher
├── soltex.vbs                 # Silent launcher wrapper
├── package.json
└── vite.config.js
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Compile |
| `Ctrl + Enter` | Compile |
| `Ctrl + /` | Show keyboard shortcuts |
| `Ctrl + G` | Go to line |
| `Ctrl + H` | Find & Replace |
| `Ctrl + B` | Toggle sidebar |
| `Ctrl + J` | Toggle log panel |
| `Ctrl + Shift + S` | Create checkpoint |

---

## Roadmap

- [x] Phase 1-2: Editor core + compilation
- [x] Phase 3-4: File tree, dashboard, search, outline
- [x] Phase 5: Template library
- [x] Phase 6: Git checkpoints + settings
- [x] Phase 7: Themes, shortcuts, file toolbar
- [ ] Phase 8: UI overhaul (design refresh)
- [ ] Phase 9: Collaborative editing (optional)
- [ ] Phase 10: Plugin system

---

## License

MIT -- do whatever you want with it.


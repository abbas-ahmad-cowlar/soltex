# Feature 5.5 — Integrated Spell Checker

> **Phase**: 5 | **Feature**: 5 of 9
> **Goal**: Wavy red underlines on misspelled words in real-time. LaTeX-aware — ignores commands, math mode, environment names, and package options. Right-click for suggestions. Multi-language support.
> **Estimated Effort**: 6–8 hours (most complex feature of Phase 5)
> **Dependencies**: Feature 1.2 (CodeMirror editor).

---

## Overview

Three components:
1. **Dictionary engine**: `typo.js` — a JavaScript port of Hunspell. Loads `.dic` + `.aff` dictionary files in the browser.
2. **LaTeX filter**: Strips commands, math, and environments before spell-checking. Only checks "text" content.
3. **CodeMirror integration**: A `ViewPlugin` that decorates misspelled words with wavy underlines.

### Approach

The spell checker runs **only on visible lines** (not the entire document). This keeps it performant even for 10,000-line documents. On each viewport change or document edit, it:
1. Gets the visible line range from CodeMirror
2. Extracts text tokens (skipping LaTeX commands and math)
3. Checks each token against the Hunspell dictionary
4. Applies `Decoration.mark` for misspelled words

---

## Step 1: Install `typo.js` and Dictionary Files

```bash
npm install typo-js
```

Dictionary files (Hunspell format):
- `en_US.dic` + `en_US.aff` — American English
- Download from: https://cgit.freedesktop.org/libreoffice/dictionaries/tree/en

Store in `public/dictionaries/en_US/`:
```
public/
  dictionaries/
    en_US/
      en_US.dic
      en_US.aff
```

---

## Step 2: Spell Checker Module

### File: `src/js/spellChecker.js`

```javascript
// src/js/spellChecker.js
import Typo from 'typo-js';
import { ViewPlugin, Decoration } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

let dictionary = null;
let isEnabled = true;
let isLoading = false;

// Decoration for misspelled words
const misspelledMark = Decoration.mark({ class: 'cm-misspelled' });

/**
 * Load the dictionary asynchronously.
 */
export async function loadDictionary(language = 'en_US') {
  if (dictionary || isLoading) return;
  isLoading = true;

  try {
    // Fetch dictionary files
    const [affData, dicData] = await Promise.all([
      fetch(`/dictionaries/${language}/${language}.aff`).then(r => r.text()),
      fetch(`/dictionaries/${language}/${language}.dic`).then(r => r.text()),
    ]);

    dictionary = new Typo(language, affData, dicData);
    isLoading = false;
    console.log(`Spell checker loaded: ${language}`);
  } catch (err) {
    isLoading = false;
    console.error('Failed to load dictionary:', err);
  }
}

/**
 * Toggle the spell checker on/off.
 */
export function toggleSpellChecker(enabled) {
  isEnabled = enabled;
}

/**
 * Get spelling suggestions for a word.
 */
export function getSuggestions(word) {
  if (!dictionary) return [];
  return dictionary.suggest(word).slice(0, 5);
}

// ---------- LaTeX-Aware Tokenizer ----------

/**
 * Regions to SKIP when spell checking:
 * - \command names (not their arguments — "Hello" in \textbf{Hello} IS checked)
 * - Math mode: $...$, $$...$$, \[...\], \(...\), \begin{equation}...\end{equation}
 * - Environment names: \begin{itemize} — "itemize" is skipped
 * - Comments: % to end of line
 * - Package/class names: \usepackage{amsmath} — "amsmath" is skipped
 * - \cite{}, \ref{}, \label{} arguments
 */

// Regex matching things to SKIP
const SKIP_PATTERNS = [
  /\\[a-zA-Z@]+/g,                        // \commands
  /%.*$/gm,                                // % comments
  /\$\$[\s\S]*?\$\$/g,                     // $$ display math $$
  /\$[^$]*?\$/g,                           // $ inline math $
  /\\\[[\s\S]*?\\\]/g,                     // \[ display math \]
  /\\\([\s\S]*?\\\)/g,                     // \( inline math \)
  /\\begin\{(equation|align|gather|multline|math|displaymath|eqnarray)\*?\}[\s\S]*?\\end\{\1\*?\}/g,
  /\\(?:cite|ref|eqref|label|pageref|autoref|cref|Cref|nameref)\{[^}]*\}/g,
  /\\(?:usepackage|RequirePackage|documentclass|bibliographystyle|bibliography|addbibresource)\{[^}]*\}/g,
  /\\(?:begin|end)\{[^}]*\}/g,             // \begin{env} / \end{env}
  /\\(?:input|include|includegraphics)\{[^}]*\}/g,
];

/**
 * Given a line of text and its offset in the document,
 * return an array of { word, from, to } for words that should be checked.
 */
function extractCheckableWords(lineText, lineOffset) {
  // Mark all skip regions
  let mask = new Array(lineText.length).fill(true); // true = checkable

  for (const pattern of SKIP_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(lineText)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (i < mask.length) mask[i] = false;
      }
    }
  }

  // Extract words from checkable regions
  const words = [];
  const wordRegex = /[a-zA-ZÀ-ÿ'-]+/g;
  let wordMatch;
  while ((wordMatch = wordRegex.exec(lineText)) !== null) {
    const start = wordMatch.index;
    const end = start + wordMatch[0].length;

    // Check if the entire word is in a checkable region
    let isCheckable = true;
    for (let i = start; i < end; i++) {
      if (!mask[i]) { isCheckable = false; break; }
    }

    if (isCheckable && wordMatch[0].length >= 2) {
      words.push({
        word: wordMatch[0],
        from: lineOffset + start,
        to: lineOffset + end,
      });
    }
  }

  return words;
}

// ---------- CodeMirror Integration ----------

/**
 * CodeMirror ViewPlugin for spell checking.
 * Only checks visible lines for performance.
 */
export const spellCheckPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (!isEnabled || !dictionary) {
        this.decorations = Decoration.none;
        return;
      }
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      if (!isEnabled || !dictionary) return Decoration.none;

      const builder = new RangeSetBuilder();
      const { from, to } = view.viewport;

      // Iterate through visible lines
      for (let pos = from; pos <= to; ) {
        const line = view.state.doc.lineAt(pos);
        const words = extractCheckableWords(line.text, line.from);

        for (const { word, from: wFrom, to: wTo } of words) {
          if (!dictionary.check(word)) {
            builder.add(wFrom, wTo, misspelledMark);
          }
        }

        pos = line.to + 1;
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

---

## Step 3: CSS — Wavy Underline

```css
/* Misspelled word decoration */
.cm-misspelled {
  text-decoration: underline wavy;
  text-decoration-color: var(--accent-error);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}
```

That's it. The `ViewPlugin` adds the `cm-misspelled` class via `Decoration.mark`. CSS does the rest.

---

## Step 4: Right-Click Spelling Suggestions

Add a custom context menu when right-clicking a misspelled word:

```javascript
// In spellChecker.js or a separate module:

/**
 * Show spelling suggestions on right-click.
 * Attached to the editor's DOM.
 */
export function setupSpellContextMenu(editorElement) {
  editorElement.addEventListener('contextmenu', (e) => {
    // Check if the click is on a misspelled word
    const target = e.target.closest('.cm-misspelled');
    if (!target) return; // Normal context menu

    e.preventDefault();

    const word = target.textContent;
    const suggestions = getSuggestions(word);

    showSpellMenu(e.clientX, e.clientY, word, suggestions, (replacement) => {
      // Replace the word in the editor
      const view = getEditorView();
      if (!view) return;

      // Find the word's position by searching near the click
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return;

      const wordAt = view.state.wordAt(pos);
      if (!wordAt) return;

      view.dispatch({
        changes: { from: wordAt.from, to: wordAt.to, insert: replacement },
      });
    });
  });
}

function showSpellMenu(x, y, word, suggestions, onSelect) {
  // Remove existing menu
  const existing = document.getElementById('spell-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'spell-menu';
  menu.className = 'context-menu spell-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  if (suggestions.length === 0) {
    menu.innerHTML = '<div class="ctx-item ctx-disabled">No suggestions</div>';
  } else {
    menu.innerHTML = suggestions.map(s =>
      `<button class="ctx-item spell-suggestion">${s}</button>`
    ).join('');
  }

  // Add "Add to dictionary" option (future)
  menu.innerHTML += '<hr class="ctx-divider" />';
  menu.innerHTML += `<button class="ctx-item" data-action="ignore">Ignore "${word}"</button>`;

  document.body.appendChild(menu);

  // Click handlers
  menu.querySelectorAll('.spell-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.textContent);
      menu.remove();
    });
  });

  // Close on click elsewhere
  setTimeout(() => {
    document.addEventListener('click', function close() {
      menu.remove();
      document.removeEventListener('click', close);
    });
  }, 0);
}
```

### CSS for Spell Menu
```css
.spell-menu {
  min-width: 160px;
}
.spell-suggestion {
  font-weight: 600;
  color: var(--accent-primary) !important;
}
.ctx-disabled {
  color: var(--text-placeholder) !important;
  cursor: default;
  pointer-events: none;
}
```

---

## Step 5: Wire Into Editor

In `editor.js`, add the spell checker to the extensions:

```javascript
import { spellCheckPlugin, loadDictionary, setupSpellContextMenu } from './spellChecker.js';

// In the extensions array:
const extensions = [
  // ... existing extensions
  spellCheckPlugin,
];

// After editor creation:
loadDictionary('en_US');
setupSpellContextMenu(document.getElementById('editor'));
```

### Toggle Button
```html
<button id="btn-spell" class="btn btn-toolbar" title="Toggle spell check">
  <span class="btn-icon">📝</span>
  <span class="btn-text">Spell</span>
</button>
```

```javascript
document.getElementById('btn-spell').addEventListener('click', () => {
  const btn = document.getElementById('btn-spell');
  btn.classList.toggle('btn-active');
  toggleSpellChecker(btn.classList.contains('btn-active'));
});
```

---

## Edge Cases

### 6.1 — LaTeX commands should NOT be underlined
`\textbf`, `\usepackage`, `\begin` → all skipped by the mask. Only the text content inside `{...}` is checked (for formatting commands like `\textbf{Hello}`).

### 6.2 — Math mode
`$E = mc^2$` → entirely skipped. No underlines in math.

### 6.3 — Comments
`% This is a coment` → the typo "coment" IS checked because comments are still English text. **Wait** — the spec says "ignores commands". Comments are debatable. For now, skip comments too (they're in `SKIP_PATTERNS`). If users want comment checking, we can add a toggle later.

### 6.4 — Contractions and hyphens
"don't", "well-known" → `typo.js` handles contractions. Hunspell dictionaries include them.

### 6.5 — Proper nouns
"Einstein", "LaTeX" → may be flagged. The user can "Ignore" them. A future improvement is a custom dictionary file.

### 6.6 — Performance
Only visible lines are checked. Scrolling triggers a re-check via `viewportChanged`. On a 1,000-line document with 200 visible lines, this is ~50ms. Acceptable.

### 6.7 — Dictionary loading time
`en_US.dic` is ~3MB. Loading takes 1–2 seconds. Show a "Loading dictionary..." indicator in the status bar.

### 6.8 — Non-English documents
Multi-language support via different dictionary files. For Phase 5, we ship `en_US` only. Additional languages can be added by dropping `.dic`/`.aff` files into `public/dictionaries/`.

---

## Do's & Don'ts

### Do's
- ✅ Check only visible lines (viewport optimization)
- ✅ Use a mask array to handle overlapping skip regions
- ✅ Show suggestions on right-click
- ✅ Allow toggling spell check on/off

### Don'ts
- ❌ Don't check inside math mode or commands
- ❌ Don't check the entire document at once
- ❌ Don't show more than 5 suggestions (too cluttered)
- ❌ Don't block the editor while loading the dictionary

---

## Final Acceptance Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Misspelled words have wavy red underline | ☐ |
| 2 | `\textbf{wrold}` → "wrold" is underlined, `\textbf` is not | ☐ |
| 3 | `$x^2$` → nothing underlined (math mode) | ☐ |
| 4 | `\usepackage{amsmath}` → nothing underlined | ☐ |
| 5 | `\begin{itemize}` → nothing underlined | ☐ |
| 6 | `% coment` → nothing underlined (comment) | ☐ |
| 7 | Right-click misspelled word → suggestions appear | ☐ |
| 8 | Click suggestion → word is replaced in editor | ☐ |
| 9 | Toggle button turns spell check on/off | ☐ |
| 10 | Scrolling updates underlines for new visible text | ☐ |
| 11 | Dictionary loads asynchronously (no UI block) | ☐ |
| 12 | Performance: no visible lag while typing | ☐ |

> **Done → Proceed to Feature 5.6 (Template Library).**

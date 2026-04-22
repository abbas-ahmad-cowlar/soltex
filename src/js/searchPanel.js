// src/js/searchPanel.js
// SolteX -- Project-Wide Search (Phase 5, Feature 5.3)

let currentProject = null;
let searchDebounce = null;
let onOpenFile = null; // callback: (filePath, lineNum) => void

/**
 * Initialize the search panel.
 */
export function initSearchPanel(project, openFileCallback) {
  currentProject = project;
  onOpenFile = openFileCallback;

  const input = document.getElementById('search-input');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(executeSearch, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(searchDebounce); executeSearch(); }
  });

  // Ctrl+Shift+F shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      const tab = document.querySelector('[data-panel="search"]');
      if (tab) tab.click();
      input.focus();
    }
  });

  console.log('SolteX: Search panel initialized');
}

async function executeSearch() {
  const query = document.getElementById('search-input').value.trim();
  const container = document.getElementById('search-results');
  if (!query) {
    container.innerHTML = '<p class="search-empty">Type to search across all files</p>';
    return;
  }

  const cs = document.getElementById('search-case')?.checked || false;
  const rx = document.getElementById('search-regex')?.checked || false;

  try {
    const params = new URLSearchParams({ q: query, caseSensitive: cs, regex: rx });
    const res = await fetch(`/api/projects/${currentProject}/search?${params}`);
    const data = await res.json();
    renderResults(data.results, data.total, query);
  } catch {
    container.innerHTML = '<p class="search-empty">Search failed</p>';
  }
}

function renderResults(results, total, query) {
  const container = document.getElementById('search-results');
  if (results.length === 0) {
    container.innerHTML = '<p class="search-empty">No results found</p>';
    return;
  }

  // Group by file
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.file]) grouped[r.file] = [];
    grouped[r.file].push(r);
  }

  let html = '';
  if (total > results.length) {
    html += `<p class="search-info">Showing ${results.length} of ${total} results</p>`;
  }

  for (const [file, matches] of Object.entries(grouped)) {
    html += `<div class="search-file-group">`;
    html += `<div class="search-file-name">${esc(file)} (${matches.length})</div>`;
    for (const m of matches) {
      html += `<div class="search-result" data-file="${m.file}" data-line="${m.line}">
        <span class="search-line-num">${m.line}</span>
        <span class="search-context">${highlight(esc(m.context), query)}</span>
      </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => {
      if (onOpenFile) onOpenFile(el.dataset.file, parseInt(el.dataset.line, 10));
    });
  });
}

function highlight(text, query) {
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-highlight">$1</mark>');
  } catch { return text; }
}

function esc(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

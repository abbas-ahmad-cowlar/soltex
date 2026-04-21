// src/js/dashboard.js
// SolteX -- Dashboard Page Logic (Phase 5)

let allProjects = [];
let viewMode = 'grid';
let showArchived = false;
let selectedTemplate = null;
let activeTab = 'blank';

document.addEventListener('DOMContentLoaded', async () => {
  await loadProjects();
  await loadTemplates();

  document.getElementById('btn-grid-view').addEventListener('click', () => setView('grid'));
  document.getElementById('btn-list-view').addEventListener('click', () => setView('list'));
  document.getElementById('search-projects').addEventListener('input', renderProjects);

  document.getElementById('show-archived').addEventListener('change', (e) => {
    showArchived = e.target.checked;
    renderProjects();
  });

  document.getElementById('btn-new-project').addEventListener('click', openModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-create').addEventListener('click', createProject);

  // Enter key on inputs
  document.getElementById('new-project-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createProject();
    if (e.key === 'Escape') closeModal();
  });
  document.getElementById('template-project-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createProject();
    if (e.key === 'Escape') closeModal();
  });

  // Modal tab switching
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      document.getElementById(`tab-${activeTab}`).style.display = 'block';
    });
  });

  document.getElementById('new-project-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
});

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    allProjects = data.projects;
    renderProjects();
  } catch (err) {
    console.error('Failed to load projects:', err);
    document.getElementById('projects-container').innerHTML =
      '<p class="error-text">Failed to load projects. Is the server running?</p>';
  }
}

async function loadTemplates() {
  try {
    const res = await fetch('/api/projects/templates');
    const data = await res.json();
    const grid = document.getElementById('template-grid');
    if (!data.templates.length) {
      grid.innerHTML = '<p class="search-empty">No templates available</p>';
      return;
    }
    grid.innerHTML = data.templates.map(t => `
      <div class="template-card" data-slug="${t.slug}">
        <span class="template-icon">${t.icon}</span>
        <h4 class="template-name">${esc(t.name)}</h4>
        <p class="template-desc">${esc(t.description)}</p>
      </div>
    `).join('');

    grid.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedTemplate = card.dataset.slug;
      });
    });
  } catch {
    document.getElementById('template-grid').innerHTML =
      '<p class="search-empty">Failed to load templates</p>';
  }
}

function renderProjects() {
  const container = document.getElementById('projects-container');
  const search = document.getElementById('search-projects').value.toLowerCase();

  let filtered = allProjects.filter(p => {
    if (!showArchived && p.archived) return false;
    if (search && !p.name.toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = search
      ? '<p class="empty-text">No projects match your search.</p>'
      : '<p class="empty-text">No projects yet. Click "+ New Project" to get started!</p>';
    return;
  }

  container.className = viewMode === 'grid' ? 'projects-grid' : 'projects-list';
  container.innerHTML = filtered.map(projectCard).join('');

  container.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions')) return;
      window.location.href = `/index.html?project=${card.dataset.slug}`;
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const slug = btn.closest('.project-card').dataset.slug;
      const name = btn.closest('.project-card').querySelector('.card-title').textContent;
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
      await fetch(`/api/projects/${slug}`, { method: 'DELETE' });
      await loadProjects();
    });
  });

  container.querySelectorAll('[data-action="archive"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const slug = btn.closest('.project-card').dataset.slug;
      const project = allProjects.find(p => p.slug === slug);
      await fetch(`/api/projects/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !project.archived }),
      });
      await loadProjects();
    });
  });
}

function projectCard(project) {
  const date = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const tags = project.tags.map(t =>
    `<span class="tag tag-${t.toLowerCase()}">${esc(t)}</span>`
  ).join('');
  const archiveLabel = project.archived ? 'Unarchive' : 'Archive';

  return `
    <div class="project-card" data-slug="${project.slug}">
      <div class="card-icon">&#128196;</div>
      <div class="card-body">
        <h3 class="card-title">${esc(project.name)}</h3>
        <p class="card-date">Modified ${date}</p>
        <div class="card-tags">${tags}</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" data-action="archive" title="${archiveLabel}">${project.archived ? '&#128194;' : '&#128451;'}</button>
        <button class="btn btn-ghost btn-sm card-delete" data-action="delete" title="Delete">&#128465;</button>
      </div>
      ${project.archived ? '<span class="card-badge">Archived</span>' : ''}
    </div>
  `;
}

function setView(mode) {
  viewMode = mode;
  document.getElementById('btn-grid-view').classList.toggle('active', mode === 'grid');
  document.getElementById('btn-list-view').classList.toggle('active', mode === 'list');
  renderProjects();
}

function openModal() {
  document.getElementById('new-project-modal').style.display = 'flex';
  selectedTemplate = null;
  document.getElementById('new-project-name').value = '';
  document.getElementById('template-project-name').value = '';
  document.getElementById('modal-error').style.display = 'none';
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
  requestAnimationFrame(() => {
    const input = activeTab === 'blank'
      ? document.getElementById('new-project-name')
      : document.getElementById('template-project-name');
    input.focus();
  });
}

function closeModal() {
  document.getElementById('new-project-modal').style.display = 'none';
}

async function createProject() {
  const name = activeTab === 'blank'
    ? document.getElementById('new-project-name').value.trim()
    : document.getElementById('template-project-name').value.trim();

  if (!name) return;

  const body = { name };
  if (activeTab === 'template' && selectedTemplate) {
    body.template = selectedTemplate;
  }

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      const errorEl = document.getElementById('modal-error');
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
      return;
    }

    window.location.href = `/index.html?project=${data.slug}`;
  } catch (err) {
    console.error('Failed to create project:', err);
  }
}

function esc(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

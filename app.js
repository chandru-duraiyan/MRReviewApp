'use strict';

// ─── Accent Color Presets ─────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { id: 'orange', label: 'Orange',
    dark:  { accent: '#fc6d26', hover: '#f05c18', soft: 'rgba(252,109,38,0.12)', glow: 'rgba(252,109,38,0.25)' },
    light: { accent: '#e85e17', hover: '#d04f0e', soft: 'rgba(232,94,23,0.1)',   glow: 'rgba(232,94,23,0.2)'  } },
  { id: 'blue', label: 'Blue',
    dark:  { accent: '#4d9ef7', hover: '#3a8ee6', soft: 'rgba(77,158,247,0.12)', glow: 'rgba(77,158,247,0.25)' },
    light: { accent: '#2563eb', hover: '#1d4ed8', soft: 'rgba(37,99,235,0.1)',   glow: 'rgba(37,99,235,0.2)'  } },
  { id: 'purple', label: 'Purple',
    dark:  { accent: '#a78bfa', hover: '#9471f5', soft: 'rgba(167,139,250,0.12)', glow: 'rgba(167,139,250,0.25)' },
    light: { accent: '#7c3aed', hover: '#6d28d9', soft: 'rgba(124,58,237,0.1)',   glow: 'rgba(124,58,237,0.2)'  } },
  { id: 'green', label: 'Green',
    dark:  { accent: '#3ecf8e', hover: '#2dbe7d', soft: 'rgba(62,207,142,0.12)',  glow: 'rgba(62,207,142,0.25)' },
    light: { accent: '#059669', hover: '#047857', soft: 'rgba(5,150,105,0.1)',    glow: 'rgba(5,150,105,0.2)'  } },
  { id: 'red', label: 'Red',
    dark:  { accent: '#f56565', hover: '#e05252', soft: 'rgba(245,101,101,0.12)', glow: 'rgba(245,101,101,0.25)' },
    light: { accent: '#dc2626', hover: '#b91c1c', soft: 'rgba(220,38,38,0.1)',    glow: 'rgba(220,38,38,0.2)'  } },
  { id: 'teal', label: 'Teal',
    dark:  { accent: '#2dd4bf', hover: '#22c4b0', soft: 'rgba(45,212,191,0.12)',  glow: 'rgba(45,212,191,0.25)' },
    light: { accent: '#0d9488', hover: '#0f766e', soft: 'rgba(13,148,136,0.1)',   glow: 'rgba(13,148,136,0.2)'  } },
  { id: 'pink', label: 'Pink',
    dark:  { accent: '#f472b6', hover: '#ec4899', soft: 'rgba(244,114,182,0.12)', glow: 'rgba(244,114,182,0.25)' },
    light: { accent: '#db2777', hover: '#be185d', soft: 'rgba(219,39,119,0.1)',   glow: 'rgba(219,39,119,0.2)'  } },
];

let _currentAccent = 'orange';

function applyCardGradient(enabled, save = true) {
  document.documentElement.classList.toggle('no-card-gradient', !enabled);
  const input = document.getElementById('cardGradientToggle');
  if (input) input.checked = enabled;
  if (save) localStorage.setItem('mrreview-card-gradient', enabled ? '1' : '0');
}

function applyAccentColor(presetId, save = true) {
  const preset = COLOR_PRESETS.find(p => p.id === presetId) || COLOR_PRESETS[0];
  _currentAccent = preset.id;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const c = isDark ? preset.dark : preset.light;

  const root = document.documentElement;
  root.style.setProperty('--accent',       c.accent);
  root.style.setProperty('--accent-hover', c.hover);
  root.style.setProperty('--accent-soft',  c.soft);
  root.style.setProperty('--accent-glow',  c.glow);
  root.style.setProperty('--border-focus', c.accent);

  if (save) localStorage.setItem('mrreview-accent', presetId);

  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.presetId === presetId);
    s.setAttribute('aria-pressed', String(s.dataset.presetId === presetId));
  });
}

function renderThemeSwatches() {
  const container = $('themeSwatches');
  if (!container) return;
  container.innerHTML = '';
  for (const preset of COLOR_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch';
    btn.dataset.presetId = preset.id;
    btn.title = preset.label;
    btn.setAttribute('aria-label', `${preset.label} accent colour`);
    btn.setAttribute('aria-pressed', String(_currentAccent === preset.id));
    btn.style.background = preset.dark.accent;
    if (_currentAccent === preset.id) btn.classList.add('active');
    btn.addEventListener('click', () => applyAccentColor(preset.id));
    container.appendChild(btn);
  }
}

// ─── GitLab API ────────────────────────────────────────────────────────────────

async function gitlabFetch(baseUrl, token, path) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4${path}`;
  const res = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token }
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Authentication failed — check your access token.');
    if (res.status === 403) throw new Error('Access denied — your token may lack the required permissions.');
    if (res.status === 404) throw new Error('Not found — check the project path and MR ID.');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed with status ${res.status}.`);
  }

  return res.json();
}

/**
 * Fetches recent notes and returns:
 *   { reviewNote, latestNote }
 *
 * - reviewNote: the most recent note whose body parses as a review assignment.
 *               Falls back through up to 25 notes to find it.
 * - latestNote: the single most recently created note (used for "no pending review" guard).
 */
async function getLatestNote(baseUrl, token, projectPath, mrIid) {
  const encodedProject = encodeURIComponent(projectPath);
  const notes = await gitlabFetch(
    baseUrl,
    token,
    `/projects/${encodedProject}/merge_requests/${mrIid}/notes?sort=desc&order_by=created_at&per_page=25`
  );
  if (!notes.length) return { reviewNote: null, latestNote: null };
  const latestNote = notes[0];
  const reviewNote = notes.find(n => !!parseReviewComment(n.body)) ?? null;
  return { reviewNote, latestNote };
}

/**
 * Fetches award emoji (reactions) for a specific note.
 */
async function getNoteReactions(baseUrl, token, projectPath, mrIid, noteId) {
  try {
    const encodedProject = encodeURIComponent(projectPath);
    return await gitlabFetch(
      baseUrl,
      token,
      `/projects/${encodedProject}/merge_requests/${mrIid}/notes/${noteId}/award_emoji`
    );
  } catch {
    // Award emoji may be disabled — return empty array gracefully
    return [];
  }
}

/**
 * Posts a comment on a merge request.
 */
async function postNote(baseUrl, token, projectPath, mrIid, body) {
  const encodedProject = encodeURIComponent(projectPath);
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/notes`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to post comment (${res.status})`);
  }
  return res.json();
}

/**
 * Fetches open MRs authored by a given username in the project.
 */
async function getOpenMRs(baseUrl, token, projectPath, username) {
  const encodedProject = encodeURIComponent(projectPath);
  return await gitlabFetch(
    baseUrl,
    token,
    `/projects/${encodedProject}/merge_requests?state=opened&author_username=${encodeURIComponent(username)}&per_page=50&order_by=updated_at&sort=desc`
  );
}

/**
 * Fetches award emoji (reactions) on the MR itself (not a note).
 * Used to find thumbsup reactions that indicate "already reviewed".
 */
async function getMRReactions(baseUrl, token, projectPath, mrIid) {
  try {
    const encodedProject = encodeURIComponent(projectPath);
    return await gitlabFetch(
      baseUrl,
      token,
      `/projects/${encodedProject}/merge_requests/${mrIid}/award_emoji?per_page=100&page=1`
    );
  } catch {
    return [];
  }
}

/**
 * Fetches basic MR info (title, web_url) for the header link.
 */
async function getMRInfo(baseUrl, token, projectPath, mrIid) {
  try {
    const encodedProject = encodeURIComponent(projectPath);
    return await gitlabFetch(
      baseUrl,
      token,
      `/projects/${encodedProject}/merge_requests/${mrIid}`
    );
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)  return 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m !== 1 ? 's' : ''} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h !== 1 ? 's' : ''} ago`;
  }
  if (diff < 2592000) {
    const d = Math.floor(diff / 86400);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Group reactions by emoji name, collecting authors. */
function groupReactions(reactions) {
  const map = new Map();
  for (const r of reactions) {
    const key = r.name;
    if (!map.has(key)) {
      map.set(key, { name: r.name, emoji: r.name, authors: [], count: 0 });
    }
    const entry = map.get(key);
    entry.count++;
    if (r.user) entry.authors.push(r.user.name || r.user.username);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Map common GitLab emoji names to actual Unicode emoji. */
const EMOJI_MAP = {
  thumbsup: '👍', thumbsdown: '👎', '+1': '👍', '-1': '👎',
  tada: '🎉', heart: '❤️', eyes: '👀', rocket: '🚀',
  100: '💯', fire: '🔥', clap: '👏', pray: '🙏',
  confused: '😕', smile: '😊', laughing: '😂', thinking: '🤔',
  facepalm: '🤦', shrug: '🤷', wave: '👋', muscle: '💪',
  white_check_mark: '✅', x: '❌', warning: '⚠️', tada2: '🎊',
  star: '⭐', star2: '🌟', sparkles: '✨', zap: '⚡',
  bug: '🐛', art: '🎨', memo: '📝', pencil: '✏️',
  construction: '🚧', lock: '🔒', key: '🔑', recycle: '♻️',
};

function resolveEmoji(name) {
  return EMOJI_MAP[name] ?? EMOJI_MAP[name.toLowerCase()] ?? `[${name}]`;
}

// ─── Review Comment Parser ────────────────────────────────────────────────────

/**
 * Detects and parses the structured code-review assignment comment format.
 * Handles both Markdown bold (**) and HTML <strong> tags.
 * Returns an array of sections, or null if the format is not recognised.
 */
function parseReviewComment(body) {
  if (!body || !/Primary\s+Reviewers/i.test(body)) return null;

  // Normalise HTML tags → Markdown equivalents so one code path handles both
  const text = body
    .replace(/<strong>\s*/gi, '**').replace(/\s*<\/strong>/gi, '**')
    .replace(/<em>\s*/gi, '_').replace(/\s*<\/em>/gi, '_')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sections = [];
  let current    = null;

  for (const line of lines) {
    // Section header: **Title** :emoji:
    const headerMatch = line.match(/^\*\*([^*]+)\*\*\s*:([\w+]+):/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { title: headerMatch[1].trim(), emoji: headerMatch[2], entries: [] };
      continue;
    }
    // File entry bullet
    if (current && /^[*\-]/.test(line)) {
      const entry = parseFileEntry(line.replace(/^[*\-]\s*/, ''));
      if (entry) current.entries.push(entry);
    }
  }
  if (current) sections.push(current);
  return sections.length > 0 ? sections : null;
}

function parseFileEntry(line) {
  // Strip all ** bold markers so we're left with plain text
  const clean = line.replace(/\*\*/g, '');

  // Path is everything before ": Primary Reviewers"
  const colonIdx = clean.search(/:\s*Primary\s+Reviewers/i);
  if (colonIdx === -1) return null;

  const path = clean.slice(0, colonIdx).trim();
  const rest = clean.slice(colonIdx + 1); // skip the colon

  return {
    path,
    primary: parseReviewerNames(extractBetweenParens(rest, 'Primary Reviewers') ?? ''),
    backup:  parseReviewerNames(extractBetweenParens(rest, 'Backup Reviewers')  ?? ''),
  };
}

/** Finds the content inside the parentheses that follow a given label. */
function extractBetweenParens(text, label) {
  const idx = text.toLowerCase().indexOf(label.toLowerCase());
  if (idx === -1) return null;

  const openIdx = text.indexOf('(', idx + label.length);
  if (openIdx === -1) return null;

  // Walk forward to find the matching closing paren (handles nested parens)
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      if (--depth === 0) return text.slice(openIdx + 1, i).trim();
    }
  }
  return null;
}

/** Splits a comma-separated reviewer string, respecting nested parentheses. */
function parseReviewerNames(raw) {
  if (!raw.trim()) return [];
  const parts  = [];
  let current  = '';
  let depth    = 0;

  for (const ch of raw) {
    if      (ch === '(')              { depth++; current += ch; }
    else if (ch === ')')              { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else                              { current += ch; }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map(parseReviewerEntry).filter(Boolean);
}

function parseReviewerEntry(raw) {
  // Strip markdown italic underscores: _name_ → name
  const stripped = raw.replace(/^_+|_+$/g, '').trim();
  if (!stripped) return null;

  // Detect role annotation: "username (Role Name)"
  const roleMatch = stripped.match(/^([^(]+)\(([^)]+)\)$/);
  if (roleMatch) {
    return {
      username:  roleMatch[1].trim(),
      role:      roleMatch[2].trim(),
      isSpecial: /security|coordinator/i.test(roleMatch[2]),
    };
  }
  return { username: stripped, role: null, isSpecial: false };
}

// ─── New JAVA Packages Parser ─────────────────────────────────────────────────

/**
 * Detects a "New JAVA Packages" section in the comment body and returns
 * { description, paths } or null if not present.
 */
function parseNewJavaPackages(body) {
  if (!body || !/New JAVA Packages/i.test(body)) return null;

  const lines = body.split('\n').map(l => l.trim());
  const idx = lines.findIndex(l => /New JAVA Packages/i.test(l));
  if (idx === -1) return null;

  // Strip bold markers and extract description after the keyword
  const headerLine = lines[idx].replace(/\*\*/g, '');
  const afterKeyword = headerLine.replace(/New JAVA Packages\s*/i, '').trim();
  // Strip a single outermost bracket/paren pair if present
  const description = afterKeyword.replace(/^[\[\(](.+?)[\]\)]\s*$/, '$1').trim() || afterKeyword;

  // Collect path-like lines that follow the header; stop at the next section.
  // Exclude lines containing HTML tags (e.g. </strong>) — they're not paths.
  const paths = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^\*\*[^*]/.test(line) || /^#{1,6}\s/.test(line)) break;
    if (line.includes('/') && !/</.test(line)) {
      paths.push(line.replace(/^[*\-\s]+/, ''));
    }
  }

  return { description, paths };
}

function renderNewJavaPackages() {
  const pkg = _erState.newJavaPackages;
  if (!pkg) {
    hideElement('erNewPackages');
    return;
  }

  const list = $('erNewPackagesList');
  list.innerHTML = '';
  for (const path of pkg.paths) {
    const row = document.createElement('div');
    row.className = 'er-np-path';
    row.textContent = path;
    list.appendChild(row);
  }

  if (pkg.paths.length > 0) {
    showElement('erNewPackages');
  } else {
    hideElement('erNewPackages');
  }
}

// ─── Review Comment Renderer ──────────────────────────────────────────────────

function getSectionMeta(title) {
  const t = title.toLowerCase();
  if (/without/.test(t))                          return { label: 'Needs Approval',  color: 'orange' };
  if (/backup/i.test(t) && /approved/i.test(t))   return { label: 'Backup Approved', color: 'yellow' };
  return { label: 'Review Required', color: 'blue' };
}

function getFileType(title) {
  const t = title.toUpperCase();
  if (t.includes('JAVA'))   return { label: 'JAVA', color: 'java' };
  if (t.includes('XML'))    return { label: 'XML',  color: 'xml'  };
  if (t.includes('PYTHON')) return { label: 'PY',   color: 'py'   };
  if (t.includes('JS'))     return { label: 'JS',   color: 'js'   };
  if (t.includes('CSS'))    return { label: 'CSS',  color: 'css'  };
  return { label: 'FILE', color: 'default' };
}

function getInitials(username) {
  const parts = username.replace(/[._\-]/g, ' ').split(' ').filter(Boolean);
  return (parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : username.slice(0, 2)
  ).toUpperCase();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderReviewBody(sections) {
  const wrap = document.createElement('div');
  wrap.className = 'review-body';

  for (const section of sections) {
    const meta     = getSectionMeta(section.title);
    const fileType = getFileType(section.title);

    const card = document.createElement('div');
    card.className = `review-section review-section--${meta.color}`;

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'review-section-header';
    header.innerHTML =
      `<div class="review-section-title">
        <span class="ft-badge ft-badge--${fileType.color}">${escapeHtml(fileType.label)}</span>
        <span>${escapeHtml(section.title)}</span>
        <span class="file-count">${section.entries.length} file${section.entries.length !== 1 ? 's' : ''}</span>
      </div>
      <span class="rs-badge rs-badge--${meta.color}">${escapeHtml(meta.label)}</span>`;
    card.appendChild(header);

    // ── File list ──
    if (section.entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'review-empty';
      empty.textContent = 'No files listed in this section.';
      card.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'review-file-list';

      for (const entry of section.entries) {
        const row = document.createElement('div');
        row.className = 'review-file-row';

        // File path heading
        const pathEl = document.createElement('div');
        pathEl.className = 'review-file-heading';

        pathEl.innerHTML =
          `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <code class="review-file-path-text" title="${escapeHtml(entry.path)}">${escapeHtml(entry.path)}</code>`;
        row.appendChild(pathEl);

        // Reviewer groups
        const reviewersEl = document.createElement('div');
        reviewersEl.className = 'review-reviewers';
        if (entry.primary.length > 0)
          reviewersEl.appendChild(buildReviewerGroup('Primary', entry.primary, 'primary'));
        if (entry.backup.length > 0)
          reviewersEl.appendChild(buildReviewerGroup('Backup', entry.backup, 'backup'));
        row.appendChild(reviewersEl);

        list.appendChild(row);
      }
      card.appendChild(list);
    }

    wrap.appendChild(card);
  }
  return wrap;
}

function buildReviewerGroup(label, reviewers, type) {
  const group = document.createElement('div');
  group.className = 'reviewer-group';

  const lbl = document.createElement('span');
  lbl.className = `rg-label rg-label--${type}`;
  lbl.textContent = label;
  group.appendChild(lbl);

  const chips = document.createElement('div');
  chips.className = 'reviewer-chips';

  for (const r of reviewers) {
    const chip = document.createElement('span');
    chip.className = `reviewer-chip reviewer-chip--${type}${r.isSpecial ? ' reviewer-chip--special' : ''}`;
    chip.title = r.role ? `${r.username} · ${r.role}` : r.username;

    if (r.isSpecial) {
      chip.innerHTML =
        `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>${escapeHtml(r.username)}</span>
        ${r.role ? `<em class="reviewer-role">${escapeHtml(r.role)}</em>` : ''}`;
    } else {
      chip.innerHTML =
        `<span class="rv-avatar">${escapeHtml(getInitials(r.username))}</span>
        <span>${escapeHtml(r.username)}</span>`;
    }
    chips.appendChild(chip);
  }

  group.appendChild(chips);
  return group;
}

// ─── Enough Reviewers ─────────────────────────────────────────────────────────

// Current MR context — updated each time an MR is loaded.
const _mrCtx = { url: null, title: null, iid: null };

// Persistent state for the current fetch — reset on each new submission.
const _erState = {
  sections:        null,
  alreadyReviewed: new Set(),
  excluded:        new Set(),
  includeBackup:   false,
  newJavaPackages: null,
};

function _recomputeEnoughReviewers() {
  const reviewers = computeMinReviewers(_erState.sections, _erState.alreadyReviewed, _erState.excluded, _erState.includeBackup);
  renderEnoughReviewers(reviewers);
  renderRemovedReviewers();
}

/**
 * Greedy set-cover: find the minimum list of reviewers that covers every
 * file in "Needs Approval" sections.
 *
 * Rules:
 *  1. Only consider sections whose meta is "Needs Approval" (orange).
 *  2. Each file's eligible pool = primary reviewers (+ backup if includeBackup).
 *  3. Iterate files in order. If any already-selected reviewer is in this
 *     file's pool → file is covered, skip it.
 *  4. Otherwise pick the reviewer (from the pool) who covers the most
 *     remaining uncovered files (greedy), add them to the selected set.
 *
 * Returns an array of { username, role, isSpecial } objects.
 */
function computeMinReviewers(sections, alreadyReviewed = new Set(), excluded = new Set(), includeBackup = false) {
  const pending = sections.filter(s => getSectionMeta(s.title).color === 'orange');

  // Flatten: each element is the eligible pool (primary only, or primary + backup).
  // - Skip files already covered by someone in the alreadyReviewed set.
  // - Exclude manually-removed reviewers from every pool.
  const files = [];
  for (const section of pending) {
    for (const entry of section.entries) {
      const primary = entry.primary.filter(r => !r.username.includes('`') && !excluded.has(r.username)).map(r => r.username);
      const backup  = includeBackup
        ? entry.backup.filter(r => !r.username.includes('`') && !excluded.has(r.username)).map(r => r.username)
        : [];
      const pool = [...primary, ...backup];
      if (pool.length === 0) continue;
      if (pool.some(u => alreadyReviewed.has(u))) continue; // already covered
      files.push(pool);
    }
  }

  if (files.length === 0) return [];

  const selectedUsernames = new Set();
  const covered           = new Array(files.length).fill(false);

  for (let i = 0; i < files.length; i++) {
    if (covered[i]) continue;

    // Already covered by a previously selected reviewer?
    if (files[i].some(u => selectedUsernames.has(u))) {
      covered[i] = true;
      continue;
    }

    // Greedy: pick the reviewer in this file's pool who covers the most
    // remaining uncovered files (including this one)
    let bestUsername = null;
    let bestCoverage = -1;

    for (const username of files[i]) {
      let count = 0;
      for (let j = i; j < files.length; j++) {
        if (!covered[j] && files[j].includes(username)) count++;
      }
      if (count > bestCoverage) {
        bestCoverage = count;
        bestUsername = username;
      }
    }

    if (bestUsername) {
      selectedUsernames.add(bestUsername);
      for (let j = i; j < files.length; j++) {
        if (files[j].includes(bestUsername)) covered[j] = true;
      }
    }
  }

  // Resolve full reviewer objects from sections
  const byUsername = new Map();
  for (const section of pending) {
    for (const entry of section.entries) {
      const all = includeBackup ? [...entry.primary, ...entry.backup] : [...entry.primary];
      for (const r of all) {
        if (!r.username.includes('`') && !byUsername.has(r.username)) byUsername.set(r.username, r);
      }
    }
  }

  return [...selectedUsernames].map(u => byUsername.get(u) ?? { username: u, role: null, isSpecial: false });
}

/**
 * Returns false if excluding `username` would leave any pending file with
 * no eligible reviewer (making it impossible to cover).
 */
function canRemoveReviewer(username) {
  if (!_erState.sections) return true;
  const testExcluded = new Set([..._erState.excluded, username]);
  const pending = _erState.sections.filter(s => getSectionMeta(s.title).color === 'orange');
  for (const section of pending) {
    for (const entry of section.entries) {
      const primary = entry.primary.filter(r => !r.username.includes('`')).map(r => r.username);
      const backup  = _erState.includeBackup
        ? entry.backup.filter(r => !r.username.includes('`')).map(r => r.username)
        : [];
      const fullPool = [...primary, ...backup];
      // File is already covered by someone who reviewed — skip
      if (fullPool.some(u => _erState.alreadyReviewed.has(u))) continue;
      // Check if any eligible reviewer remains after exclusion
      if (fullPool.filter(u => !testExcluded.has(u)).length === 0) return false;
    }
  }
  return true;
}

function resolveReviewerFromSections(username) {
  if (!_erState.sections) return { username, role: null, isSpecial: false };
  for (const section of _erState.sections) {
    for (const entry of section.entries) {
      for (const r of [...entry.primary, ...entry.backup]) {
        if (r.username === username) return r;
      }
    }
  }
  return { username, role: null, isSpecial: false };
}

let _erErrorTimer = null;
function showErError(msg) {
  const el = $('erError');
  el.textContent = msg;
  showElement('erError');
  clearTimeout(_erErrorTimer);
  _erErrorTimer = setTimeout(() => hideElement('erError'), 3500);
}

function renderEnoughReviewers(reviewers) {
  // Keep card visible if there are removed reviewers to show
  if ((!reviewers || reviewers.length === 0) && _erState.excluded.size === 0) {
    hideElement('enoughReviewers');
    hideElement('erAskNotifyDot');
    return;
  }

  // Show notification dot only when there are pending reviewers to ask
  if (reviewers && reviewers.length > 0) {
    showElement('erAskNotifyDot');
  } else {
    hideElement('erAskNotifyDot');
  }

  $('erBadge').textContent = reviewers && reviewers.length > 0
    ? `${reviewers.length} needed`
    : 'All covered';

  const chips = $('erChips');
  chips.innerHTML = '';

  for (const r of (reviewers || [])) {
    const chip = document.createElement('span');
    chip.className = `er-chip${r.isSpecial ? ' er-chip--special' : ''}`;
    chip.title = r.role ? `${r.username} · ${r.role}` : r.username;

    const inner = r.isSpecial
      ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>${escapeHtml(r.username)}</span>
        ${r.role ? `<em class="er-chip-role">${escapeHtml(r.role)}</em>` : ''}`
      : `<span class="rv-avatar er-avatar">${escapeHtml(getInitials(r.username))}</span>
        <span>${escapeHtml(r.username)}</span>`;

    chip.innerHTML = inner +
      `<button class="er-chip-remove" title="Remove ${escapeHtml(r.username)}" aria-label="Remove ${escapeHtml(r.username)}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;

    chip.querySelector('.er-chip-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!canRemoveReviewer(r.username)) {
        showErError(`Can't remove ${r.username} — it would leave some files without any reviewer.`);
        return;
      }
      _erState.excluded.add(r.username);
      _recomputeEnoughReviewers();
    });

    chips.appendChild(chip);
  }

  showElement('enoughReviewers');
}

function renderRemovedReviewers() {
  const removedChips = $('erRemovedChips');
  removedChips.innerHTML = '';

  if (_erState.excluded.size === 0) {
    hideElement('erRemovedSection');
    return;
  }

  for (const username of _erState.excluded) {
    const r = resolveReviewerFromSections(username);
    const chip = document.createElement('span');
    chip.className = 'er-removed-chip';
    chip.title = `Re-add ${username}`;
    chip.innerHTML =
      `<span class="rv-avatar er-removed-avatar">${escapeHtml(getInitials(username))}</span>
      <span>${escapeHtml(username)}</span>
      <button class="er-chip-readd" title="Re-add ${escapeHtml(username)}" aria-label="Re-add ${escapeHtml(username)}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>`;

    chip.querySelector('.er-chip-readd').addEventListener('click', (e) => {
      e.stopPropagation();
      _erState.excluded.delete(r.username);
      hideElement('erError');
      _recomputeEnoughReviewers();
    });

    removedChips.appendChild(chip);
  }

  showElement('erRemovedSection');
}

function renderAlreadyReviewed(reactions) {
  const thumbsups = reactions.filter(r => r.name === 'thumbsup' && r.user);
  if (thumbsups.length === 0) {
    hideElement('alreadyReviewed');
    return;
  }

  $('arBadge').textContent = `${thumbsups.length} reviewed`;

  const chips = $('arChips');
  chips.innerHTML = '';

  for (const r of thumbsups) {
    const name = r.user.name || r.user.username;
    const chip = document.createElement('span');
    chip.className = 'ar-chip';
    chip.title = name;
    chip.innerHTML =
      `<span class="rv-avatar ar-avatar">${escapeHtml(getInitials(name))}</span>
      <span>${escapeHtml(name)}</span>`;
    chips.appendChild(chip);
  }

  showElement('alreadyReviewed');
}

// ─── UI ───────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function showElement(id)  { $(id).classList.remove('hidden'); }
function hideElement(id)  { $(id).classList.add('hidden'); }

function showError(title, message) {
  hideElement('loading');
  hideElement('results');
  $('errorTitle').textContent   = title;
  $('errorMessage').textContent = message;
  showElement('errorCard');
}

function showLoading() {
  hideElement('errorCard');
  hideElement('results');
  showElement('loading');
}

function renderComment(note, reactions, mrInfo, { mrIid }, mrReactions = []) {
  _mrCtx.url   = mrInfo?.web_url ?? null;
  _mrCtx.title = mrInfo?.title ?? null;
  _mrCtx.iid   = mrIid;
  hideElement('loading');
  hideElement('errorCard');
  hideElement('noComments');
  hideElement('commentCard');

  // MR link
  if (mrInfo?.web_url) {
    const link = $('mrLink');
    link.href = mrInfo.web_url;
    link.innerHTML = '';
    const textSpan = document.createElement('span');
    textSpan.className = 'mr-link-text';
    textSpan.textContent = `!${mrIid}${mrInfo.title ? ' — ' + mrInfo.title : ''}`;
    link.appendChild(textSpan);
    // External link icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '12'); icon.setAttribute('height', '12');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2.5');
    icon.innerHTML = '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
    link.appendChild(icon);
  }

  // Avatar
  const avatar = $('authorAvatar');
  if (note.author?.avatar_url) {
    avatar.src   = note.author.avatar_url;
    avatar.alt   = note.author.name || note.author.username;
  } else {
    // Fallback: initial avatar
    avatar.style.display = 'none';
  }

  // Author & time
  $('authorName').textContent = note.author?.name || note.author?.username || 'Unknown';
  $('commentTime').textContent = formatRelativeTime(note.created_at);

  // Permalink
  const permalink = $('commentPermalink');
  if (note.noteable_web_url) {
    permalink.href = `${note.noteable_web_url}#note_${note.id}`;
  } else if (mrInfo?.web_url) {
    permalink.href = `${mrInfo.web_url}#note_${note.id}`;
  } else {
    permalink.style.display = 'none';
  }

  // Body — try structured review format first, fall back to plain text
  const bodyEl   = $('commentBody');
  const sections = parseReviewComment(note.body);
  if (sections) {
    const alreadyReviewed = new Set(
      mrReactions.filter(r => r.name === 'thumbsup' && r.user).map(r => r.user.username)
    );

    // If every pending file is already covered by someone who reviewed,
    // there are no reviewers left to assign — treat as "No Pending Review".
    const remaining = computeMinReviewers(sections, alreadyReviewed, new Set());
    if (remaining.length === 0) {
      hideElement('enoughReviewers');
      renderEmpty(mrInfo, 'all-reviewed');
      return;
    }

    bodyEl.textContent = '';
    bodyEl.classList.add('review-body-container');
    bodyEl.appendChild(renderReviewBody(sections));
    _erState.sections        = sections;
    _erState.alreadyReviewed = alreadyReviewed;
    _erState.newJavaPackages = parseNewJavaPackages(note.body);
    _recomputeEnoughReviewers();
    renderNewJavaPackages();
  } else {
    bodyEl.classList.remove('review-body-container');
    bodyEl.textContent = note.body || '';
    hideElement('enoughReviewers');
    hideElement('erNewPackages');
  }

  // Reactions
  if (reactions.length > 0) {
    const grouped = groupReactions(reactions);
    const list    = $('reactionsList');
    list.innerHTML = '';

    for (const r of grouped) {
      const chip = document.createElement('span');
      chip.className = 'reaction-chip';
      chip.title     = r.authors.length ? `${r.name}: ${r.authors.join(', ')}` : r.name;
      chip.dataset.tooltip = r.authors.length
        ? r.authors.slice(0, 5).join(', ') + (r.authors.length > 5 ? ` +${r.authors.length - 5}` : '')
        : '';

      const emoji = document.createElement('span');
      emoji.className = 'reaction-emoji';
      emoji.textContent = resolveEmoji(r.name);

      const count = document.createElement('span');
      count.className   = 'reaction-count';
      count.textContent = r.count;

      chip.appendChild(emoji);
      chip.appendChild(count);
      list.appendChild(chip);
    }

    showElement('reactionsSection');
    hideElement('noReactions');
  } else {
    hideElement('reactionsSection');
    showElement('noReactions');
  }

  showElement('commentCard');
  showElement('results');
}

function renderEmpty(mrInfo, reason = 'no-comments') {
  _mrCtx.url   = mrInfo?.web_url ?? null;
  _mrCtx.title = mrInfo?.title ?? null;
  hideElement('loading');
  hideElement('errorCard');
  hideElement('commentCard');

  if (mrInfo?.web_url) {
    $('mrLink').href = mrInfo.web_url;
  }

  $('noComments').querySelector('p').textContent = reason === 'all-reviewed'
    ? 'All reviewers have reviewed this MR. No pending review.'
    : 'No comments on this merge request yet.';

  showElement('noComments');
  showElement('results');
}

function setLoadingMsg(main, detail) {
  $('loadingMsg').textContent = main;
  const detailEl = $('loadingDetail');
  if (detail !== undefined) {
    detailEl.textContent = detail;
    detailEl.classList.remove('hidden');
  } else {
    detailEl.classList.add('hidden');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function countdownWait(seconds) {
  for (let i = seconds; i > 0; i--) {
    setLoadingMsg(
      'Waiting for review assignment…',
      `@gunther is generating reviewer details — ${i}s`
    );
    await sleep(1000);
  }
  setLoadingMsg('Fetching review assignment…');
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  const baseUrl      = $('gitlabUrl').value.trim();
  const projectPath  = $('projectPath').value.trim();
  const mrIid        = $('mrIid').value.trim();
  const token        = $('accessToken').value.trim();

  if (!baseUrl || !projectPath || !mrIid || !token) return;

  const btn = $('submitBtn');
  btn.disabled = true;

  // Reset state for the new fetch
  _erState.excluded.clear();
  _erState.includeBackup = false;
  _erState.newJavaPackages = null;
  const backupToggle = $('erIncludeBackupToggle');
  if (backupToggle) backupToggle.checked = false;
  _mrCtx.url = null; _mrCtx.title = null; _mrCtx.iid = null;
  hideElement('erAskPanel');
  hideElement('erNewPackages');

  $('erAskBtn').classList.remove('active');
  $('erAskBubble').innerHTML = '';

  showLoading();

  try {
    setLoadingMsg('Fetching MR data…');
    let [{ reviewNote, latestNote }, mrInfo, mrReactions] = await Promise.all([
      getLatestNote(baseUrl, token, projectPath, mrIid),
      getMRInfo(baseUrl, token, projectPath, mrIid),
      getMRReactions(baseUrl, token, projectPath, mrIid),
    ]);

    // Use the most recent comment that contains reviewer details if found.
    // Otherwise fall back through the @gunther trigger flow.
    let note = reviewNote;
    
    if (!note) {
      const isNoPendingReview = latestNote && /no pending review/i.test(latestNote.body.trim());
      if (!isNoPendingReview) {
        setLoadingMsg('No review assignment found — triggering @gunther…');
        try {
          await postNote(baseUrl, token, projectPath, mrIid, '@gunther pendingreview');
        } catch (triggerErr) {
          // Non-fatal — bot may already be processing; continue to wait regardless
          console.warn('[MR Review] Could not post trigger comment:', triggerErr);
        }
        await countdownWait(12);
        ({ reviewNote: note } = await getLatestNote(baseUrl, token, projectPath, mrIid));
      } else {
        note = latestNote;
      }
    }

    if (!note) {
      hideElement('alreadyReviewed');
      renderEmpty(mrInfo);
      return;
    }

    const reactions = await getNoteReactions(baseUrl, token, projectPath, mrIid, note.id);
    renderAlreadyReviewed(mrReactions);
    renderComment(note, reactions, mrInfo, { mrIid }, mrReactions);

  } catch (err) {
    const msg = err.message || 'An unexpected error occurred.';

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      showError(
        'Network Error',
        'Could not reach the GitLab instance. If using a self-hosted instance, ' +
        'ensure it is accessible and CORS is configured. Check the console for details.'
      );
    } else {
      showError('Request Failed', msg);
    }

    console.error('[MR Review]', err);
  } finally {
    btn.disabled = false;
  }
}

// ─── Run Gunther Handler ──────────────────────────────────────────────────────

async function handleRunGunther() {
  const baseUrl     = $('gitlabUrl').value.trim();
  const projectPath = $('projectPath').value.trim();
  const mrIid       = $('mrIid').value.trim();
  const token       = $('accessToken').value.trim();

  if (!baseUrl || !projectPath || !mrIid || !token) return;

  const btn       = $('runGuntherBtn');
  const submitBtn = $('submitBtn');
  btn.disabled       = true;
  submitBtn.disabled = true;

  // Reset state
  _erState.excluded.clear();
  _erState.includeBackup = false;
  _erState.newJavaPackages = null;
  const backupToggle = $('erIncludeBackupToggle');
  if (backupToggle) backupToggle.checked = false;
  _mrCtx.url = null; _mrCtx.title = null; _mrCtx.iid = null;
  hideElement('erAskPanel');
  hideElement('erNewPackages');

  $('erAskBtn').classList.remove('active');
  $('erAskBubble').innerHTML = '';

  showLoading();

  try {
    setLoadingMsg('Posting @gunther pendingreview…');
    const [mrInfo, mrReactions] = await Promise.all([
      getMRInfo(baseUrl, token, projectPath, mrIid),
      getMRReactions(baseUrl, token, projectPath, mrIid),
    ]);

    try {
      await postNote(baseUrl, token, projectPath, mrIid, '@gunther pendingreview');
    } catch (triggerErr) {
      console.warn('[MR Review] Could not post trigger comment:', triggerErr);
    }

    await countdownWait(12);

    const { reviewNote } = await getLatestNote(baseUrl, token, projectPath, mrIid);

    if (!reviewNote) {
      hideElement('alreadyReviewed');
      renderEmpty(mrInfo);
      return;
    }

    const reactions = await getNoteReactions(baseUrl, token, projectPath, mrIid, reviewNote.id);
    renderAlreadyReviewed(mrReactions);
    renderComment(reviewNote, reactions, mrInfo, { mrIid }, mrReactions);

  } catch (err) {
    const msg = err.message || 'An unexpected error occurred.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      showError('Network Error', 'Could not reach the GitLab instance. Check the console for details.');
    } else {
      showError('Request Failed', msg);
    }
    console.error('[MR Review]', err);
  } finally {
    btn.disabled       = false;
    submitBtn.disabled = false;
  }
}

// ─── Ask Review Panel ────────────────────────────────────────────────────────

function initErAskPanel() {
  const btn        = $('erAskBtn');
  const panel      = $('erAskPanel');
  const closeBtn   = $('closeErAskPanel');
  const bubble     = $('erAskBubble');
  const copyBtn        = $('erAskCopyBtn');
  const copyLabel      = $('erAskCopyLabel');
  const copyJsonBtn    = $('erAskCopyJsonBtn');
  const copyJsonLabel  = $('erAskCopyJsonLabel');
  const jsonInfoBtn    = $('erJsonInfoBtn');
  const jsonInfoPanel  = $('erJsonInfoPanel');
  const flavours       = $('erAskFlavours');
  const salutEl        = $('erAskSalutations');

  const templates = (typeof ASK_MESSAGES !== 'undefined' && ASK_MESSAGES.length)
    ? ASK_MESSAGES
    : [{ id: 'default', label: 'Default', text: 'Hi{salutation}, could you please review this MR when you have a moment? {link}' }];

  // @ts-ignore — ASK_SALUTATIONS is defined in ask-messages.js loaded before this script
  const salutations = (typeof ASK_SALUTATIONS !== 'undefined' && ASK_SALUTATIONS.length)
    ? ASK_SALUTATIONS
    : [{ id: 'none', label: 'None', value: '' }];

  let activeId    = templates[0].id;
  let activeSalut = salutations[0].id; // default: None

  // Populate the contenteditable bubble:
  // text before {link} → editable text node
  // {link}             → <a contenteditable="false"> (locked, clickable)
  // text after {link}  → editable text node
  function populateBubble() {
    const { url, iid, title } = _mrCtx;
    const linkLabel  = iid ? `MR !${iid}${title ? ' — ' + title : ''}` : 'this MR';
    const salutValue = (salutations.find(s => s.id === activeSalut) || salutations[0]).value;
    const tpl        = templates.find(t => t.id === activeId) || templates[0];
    const resolved   = tpl.text.replace('{salutation}', salutValue);
    const parts      = resolved.split('{link}');

    bubble.innerHTML = '';
    bubble.appendChild(document.createTextNode(parts[0] || ''));

    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.contentEditable = 'false';
      a.className = 'er-ask-mr-link';
      a.textContent = linkLabel;
      a.dataset.mdLink = `[${linkLabel}](${url})`;
      bubble.appendChild(a);
    } else {
      bubble.appendChild(document.createTextNode(linkLabel));
    }

    bubble.appendChild(document.createTextNode(parts[1] || ''));
  }

  // Walk child nodes to build the copy string:
  // text nodes → their text, link anchor → its data-md-link markdown
  function getCopyText() {
    let text = '';
    for (const node of bubble.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.dataset?.mdLink) {
        text += node.dataset.mdLink;
      } else {
        text += node.textContent;
      }
    }
    return text;
  }

  function renderPills(container, items, getActiveId, onSelect) {
    container.innerHTML = '';
    for (const item of items) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'er-ask-flavour' + (item.id === getActiveId() ? ' active' : '');
      pill.textContent = item.label;
      pill.addEventListener('click', () => {
        onSelect(item.id);
        container.querySelectorAll('.er-ask-flavour').forEach(p =>
          p.classList.toggle('active', p.textContent === item.label)
        );
        populateBubble();
        copyLabel.textContent = 'Copy message';
      });
      container.appendChild(pill);
    }
  }

  function openPanel() {
    renderPills(flavours, templates, () => activeId, id => { activeId = id; });
    renderPills(salutEl,  salutations, () => activeSalut, id => { activeSalut = id; });
    populateBubble();
    copyLabel.textContent = 'Copy message';
    showElement('erAskPanel');
    btn.classList.add('active');
    hideElement('erAskNotifyDot');
  }

  function closePanel() {
    hideElement('erAskPanel');
    btn.classList.remove('active');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('hidden') ? openPanel() : closePanel();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(getCopyText()).then(() => {
      copyLabel.textContent = 'Copied!';
      setTimeout(() => { copyLabel.textContent = 'Copy message'; }, 2000);
    });
  });

  function closeJsonInfo() {
    jsonInfoPanel.classList.add('hidden');
    jsonInfoBtn.classList.remove('active');
  }

  jsonInfoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !jsonInfoPanel.classList.contains('hidden');
    isOpen ? closeJsonInfo() : (jsonInfoPanel.classList.remove('hidden'), jsonInfoBtn.classList.add('active'));
  });

  document.addEventListener('click', (e) => {
    if (!jsonInfoPanel.contains(e.target) && e.target !== jsonInfoBtn) closeJsonInfo();
  });

  // Returns only the text-node content of the bubble, omitting the MR link anchor.
  // Used for the JSON `message` field so the link isn't duplicated (it goes in `mr_link`).
  function getMessageText() {
    let text = '';
    for (const node of bubble.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    }
    return text.trim();
  }

  copyJsonBtn.addEventListener('click', () => {
    const minReviewers = computeMinReviewers(
      _erState.sections,
      _erState.alreadyReviewed,
      _erState.excluded,
      _erState.includeBackup
    );

    const mrTitle = _mrCtx.iid
      ? `MR !${_mrCtx.iid}${_mrCtx.title ? ' \u2014 ' + _mrCtx.title : ''}`
      : '';

    const payload = {
      data: [
        {
          not_reviewed_by: minReviewers.map(r => r.username),
          message:         getMessageText(),
          mr_title:        mrTitle,
          mr_link:         _mrCtx.url || '',
        }
      ]
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 4)).then(() => {
      copyJsonLabel.textContent = 'Copied!';
      setTimeout(() => { copyJsonLabel.textContent = 'Copy JSON'; }, 2000);
    });
  });
}

// ─── MR Dropdown ─────────────────────────────────────────────────────────────

function initMRDropdown() {
  const input    = $('mrIid');
  const dropdown = $('mrDropdown');
  const list     = $('mrDropdownList');
  let   fetched  = false;

  function closeDropdown() {
    hideElement('mrDropdown');
    fetched = false;
  }

  function selectMR(iid) {
    input.value = iid;
    closeDropdown();
    $('mrForm').requestSubmit();
  }

  function renderDropdown(mrs) {
    list.innerHTML = '';

    if (mrs.length === 0) {
      list.innerHTML = '<div class="mr-dd-empty">No open MRs found</div>';
      showElement('mrDropdown');
      return;
    }

    for (const mr of mrs) {
      const item = document.createElement('div');
      item.className = 'mr-dd-item';
      item.innerHTML =
        `<span class="mr-dd-iid">!${escapeHtml(String(mr.iid))}</span>
         <span class="mr-dd-title">${escapeHtml(mr.title)}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent input blur before click registers
        selectMR(mr.iid);
      });
      list.appendChild(item);
    }

    showElement('mrDropdown');
  }

  function renderLoading() {
    list.innerHTML = '<div class="mr-dd-loading"><span class="mr-dd-spinner"></span>Loading…</div>';
    showElement('mrDropdown');
  }

  function renderError(msg) {
    list.innerHTML = `<div class="mr-dd-empty">${escapeHtml(msg)}</div>`;
    showElement('mrDropdown');
  }

  async function fetchAndRender() {
    if (fetched) return;
    fetched = true;

    const baseUrl     = $('gitlabUrl').value.trim();
    const projectPath = $('projectPath').value.trim();
    const token       = $('accessToken').value.trim();
    const username    = $('gitUsername').value.trim();

    if (!baseUrl || !projectPath || !token || !username) {
      renderError('Fill in Settings (URL, Project, Token, Username) first');
      return;
    }

    renderLoading();
    try {
      const mrs = await getOpenMRs(baseUrl, token, projectPath, username);
      renderDropdown(mrs);
    } catch (err) {
      renderError(err.message || 'Failed to load MRs');
    }
  }

  input.addEventListener('focus', fetchAndRender);
  input.addEventListener('click', fetchAndRender);

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) closeDropdown();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  // Re-fetch if settings change
  ['gitlabUrl', 'projectPath', 'accessToken', 'gitUsername'].forEach(id => {
    $(id).addEventListener('input', () => { fetched = false; });
  });
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Apply defaults: config.js takes priority for accessToken and gitUsername;
  // fall back to localStorage when config has no value.
  if (typeof CONFIG !== 'undefined') {
    if (CONFIG.gitlabUrl)   $('gitlabUrl').value   = CONFIG.gitlabUrl;
    if (CONFIG.projectPath) $('projectPath').value = CONFIG.projectPath;

    // Access token — config.js wins if set, otherwise restore from localStorage
    const storedToken    = localStorage.getItem('mrreview-accessToken') || '';
    const resolvedToken  = CONFIG.accessToken || storedToken;
    if (resolvedToken) {
      $('accessToken').value = resolvedToken;
      if (CONFIG.accessToken) localStorage.setItem('mrreview-accessToken', CONFIG.accessToken);
    }

    // Git username — config.js wins if set, otherwise restore from localStorage
    const storedUsername   = localStorage.getItem('mrreview-gitUsername') || '';
    const resolvedUsername = CONFIG.gitUsername || storedUsername;
    if (resolvedUsername) {
      $('gitUsername').value = resolvedUsername;
      if (CONFIG.gitUsername) localStorage.setItem('mrreview-gitUsername', CONFIG.gitUsername);
    }
  }

  // Persist accessToken and gitUsername edits to localStorage
  $('accessToken').addEventListener('input', () => {
    localStorage.setItem('mrreview-accessToken', $('accessToken').value.trim());
  });
  $('gitUsername').addEventListener('input', () => {
    localStorage.setItem('mrreview-gitUsername', $('gitUsername').value.trim());
  });

  // Settings alert dot — show when any settings field is empty
  function checkSettingsFields() {
    let anyEmpty = false;
    for (const id of ['gitlabUrl', 'projectPath', 'accessToken', 'gitUsername']) {
      const el = $(id);
      const empty = !el.value.trim();
      el.classList.toggle('field-empty', empty);
      if (empty) anyEmpty = true;
    }
    anyEmpty ? showElement('settingsAlertDot') : hideElement('settingsAlertDot');
  }

  ['gitlabUrl', 'projectPath', 'accessToken', 'gitUsername'].forEach(id => {
    $(id).addEventListener('input', checkSettingsFields);
  });

  checkSettingsFields();

  // Form submit
  $('mrForm').addEventListener('submit', handleSubmit);

  // Run Gunther button
  $('runGuntherBtn').addEventListener('click', handleRunGunther);


  // Theme toggle
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('iconMoon').style.display = theme === 'light' ? 'none' : '';
    $('iconSun').style.display  = theme === 'light' ? ''     : 'none';
    localStorage.setItem('mrreview-theme', theme);
    applyAccentColor(_currentAccent, false); // re-map accent vars for new mode
  }

  const savedTheme = localStorage.getItem('mrreview-theme');
  if (savedTheme === 'dark') applyTheme('dark');
  else applyTheme('light');

  // Accent colour — load, render swatches, apply
  const savedAccent = localStorage.getItem('mrreview-accent') || 'orange';
  _currentAccent = savedAccent;
  renderThemeSwatches();
  applyAccentColor(savedAccent, false);

  // Card gradient — load and apply (default: enabled)
  const savedGradient = localStorage.getItem('mrreview-card-gradient');
  applyCardGradient(savedGradient !== '0', false);
  $('cardGradientToggle').addEventListener('change', e => applyCardGradient(e.target.checked));

  $('themeBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  // Settings drawer
  function openSettings() {
    showElement('settingsDrawer');
    showElement('settingsOverlay');
    $('settingsBtn').classList.add('active');
  }
  function closeSettings() {
    hideElement('settingsDrawer');
    hideElement('settingsOverlay');
    $('settingsBtn').classList.remove('active');
  }

  $('settingsBtn').addEventListener('click', () => {
    $('settingsDrawer').classList.contains('hidden') ? openSettings() : closeSettings();
  });
  $('closeSettings').addEventListener('click', closeSettings);
  $('settingsOverlay').addEventListener('click', closeSettings);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSettings();
  });

  // Toggle password visibility
  $('toggleToken').addEventListener('click', () => {
    const input    = $('accessToken');
    const isHidden = input.type === 'password';
    input.type     = isHidden ? 'text' : 'password';
    $('eyeOpen').style.display   = isHidden ? 'none' : '';
    $('eyeClosed').style.display = isHidden ? ''     : 'none';
  });

  // Token help panel
  $('tokenHelp').addEventListener('click', e => {
    e.preventDefault();
    toggleElement('tokenHelpPanel');
  });
  $('closeHelp').addEventListener('click', () => hideElement('tokenHelpPanel'));

  // Enter in MR ID field submits
  $('mrIid').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('mrForm').requestSubmit();
  });

  // MR dropdown
  initMRDropdown();

  // Ask Review panel
  initErAskPanel();

  // Backup reviewers toggle
  $('erIncludeBackupToggle').addEventListener('change', (e) => {
    _erState.includeBackup = e.target.checked;
    _erState.excluded.clear();
    _recomputeEnoughReviewers();
  });

  // How to Use panel
  function openHowTo()  { showElement('howToPanel');  $('howToUseBtn').classList.add('active'); }
  function closeHowTo() { hideElement('howToPanel'); $('howToUseBtn').classList.remove('active'); }

  $('howToUseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('howToPanel').classList.contains('hidden') ? openHowTo() : closeHowTo();
  });
  $('closeHowToPanel').addEventListener('click', (e) => { e.stopPropagation(); closeHowTo(); });
  document.addEventListener('click', (e) => {
    if (!$('howToPanel').classList.contains('hidden') &&
        !$('howToPanel').contains(e.target) &&
        e.target !== $('howToUseBtn')) {
      closeHowTo();
    }
  });
});

function toggleElement(id) {
  const el = $(id);
  el.classList.contains('hidden') ? showElement(id) : hideElement(id);
}

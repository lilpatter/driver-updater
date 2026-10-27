'use strict';

const T = window.__TAURI__;
const invoke = (cmd, args) => T.core.invoke(cmd, args);
const appWindow = T.window.getCurrentWindow();

// SF Symbols-style line icons (24pt grid).
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  gamepad: '<path d="M6 11h4M8 9v4"/><path d="M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-3.96 3.43l-.9 6.33A2.5 2.5 0 0 0 6.1 16.9L8 15h8l1.9 1.9a2.5 2.5 0 0 0 4.26-2.14l-.9-6.33A4 4 0 0 0 17.3 5z"/>',
  brush: '<path d="M9.06 11.9 17.5 3.5a2.12 2.12 0 0 1 3 3l-8.4 8.44"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  gauge: '<path d="M12 14 16 9"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>',
  memory: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v10M11 7v10M15 7v10M3 20h18"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4-1 1.5-3 2.5-6 3zM14 12c4 0 7 1 7 4 0 2-2 3-4 2-1.5-1-2.5-3-3-6zM12 14c0 4-1 7-4 7-2 0-3-2-2-4 1-1.5 3-2.5 6-3zM10 12c-4 0-7-1-7-4 0-2 2-3 4-2 1.5 1 2.5 3 3 6z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>'
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const state = {
  page: 'home',
  settings: null,
  detection: null,
  product: null,
  drivers: { gr: [], st: [] },
  loading: true,
  error: null,
  checkedAt: null,
  slide: 0,
  articles: {},
  billboards: {},
  games: {},
  installers: [],
  download: null,
  pendingInstall: null,
  installing: false,
  telemetry: null,
  query: ''
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

function fmtBytes(n) {
  if (!n) return '0 MB';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i >= 3 ? 2 : i === 2 ? 0 : 0)} ${u[i]}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function relDate(iso) {
  if (!iso) return '';
  const days = Math.round((Date.now() - Date.parse(`${iso}T12:00:00Z`)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

function fmtDuration(sec) {
  if (!isFinite(sec) || sec <= 0) return '';
  if (sec < 60) return `${Math.ceil(sec)} sec left`;
  const m = Math.ceil(sec / 60);
  return m === 1 ? 'about a minute left' : `${m} min left`;
}

const installed = () => state.detection?.gpu?.driverVersion || null;
const allDrivers = () => [...state.drivers.gr, ...state.drivers.st];
const findDriver = (version, studio) => allDrivers().find((d) => d.version === version && (studio === undefined || d.isStudio === studio));
const installerFor = (version) => state.installers.find((i) => i.version === version && !i.partial);
const partialFor = (version) => state.installers.find((i) => i.version === version && i.partial);
const channelLabel = (d) => (d.isStudio ? 'Studio Driver' : 'Game Ready Driver');
const preferStudio = () => state.settings?.channel === 'studio';

function slides() {
  const gr = state.drivers.gr[0];
  const st = state.drivers.st[0];
  return (preferStudio() ? [st, gr] : [gr, st]).filter(Boolean);
}

function recommended() {
  return (preferStudio() ? state.drivers.st[0] : state.drivers.gr[0]) || null;
}

function updateAvailable() {
  const r = recommended();
  return !!(r && installed() && cmpVersion(r.version, installed()) > 0);
}

function summary(d) {
  const meta = d.articleUrl && state.articles[d.articleUrl];
  if (meta?.description) return meta.description;
  const text = new DOMParser().parseFromString(d.notesHtml, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
  const rest = text.startsWith(d.rawHeadline) ? text.slice(d.rawHeadline.length).trim() : text;
  const first = rest.split(/(?<=\.)\s/)[0] || '';
  return first.length > 220 ? `${first.slice(0, 217)}…` : first;
}

// Prefer clean key art of the headline game; NVIDIA's article images carry their own lettering.
function heroImage(d) {
  if (!d.isStudio) {
    const game = d.games.map((g) => state.games[g]).find((g) => g?.hero);
    if (game) return { src: game.hero };
    if (d.games.some((g) => !state.games[g])) return null;
  }
  const billboard = d.billboardUrl && state.billboards[d.billboardUrl];
  if (billboard) return { src: billboard, billboard: true };
  if (d.billboardUrl && state.billboards[d.billboardUrl] === undefined) return null;
  const src = articleImage(d);
  return src ? { src } : null;
}

function articleImage(d) {
  const meta = d.articleUrl && state.articles[d.articleUrl];
  return meta?.image || d.bannerImage || (d.billboardUrl && state.billboards[d.billboardUrl]) || null;
}

function decodeEntities(s) {
  return new DOMParser().parseFromString(`<i>${s}</i>`, 'text/html').body.textContent;
}

// Studio notes open with a section label ("Applications"), not a title.
function tidy(d) {
  const headline = decodeEntities(d.headline);
  const usable = d.isStudio ? /studio|creative|support/i.test(headline) : true;
  return { ...d, rawHeadline: headline, headline: usable ? headline : decodeEntities(d.name), games: d.games.map(decodeEntities) };
}

// ---------- Release notes sanitizer: keep structure, drop everything else ----------
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out = document.createElement('div');
  const keep = new Set(['B', 'STRONG', 'BR', 'UL', 'OL', 'LI', 'P', 'A', 'I', 'EM']);
  const text = (dst, s) => {
    s.split(/(\[\d{6,8}\])/).forEach((part) => {
      if (!part) return;
      if (/^\[\d{6,8}\]$/.test(part)) {
        const span = document.createElement('span');
        span.className = 'bug';
        span.textContent = part;
        dst.appendChild(span);
      } else dst.appendChild(document.createTextNode(part));
    });
  };
  const walk = (src, dst) => {
    for (const n of src.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) { text(dst, n.textContent); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'IMG', 'IFRAME', 'OBJECT'].includes(n.tagName)) continue;
      if (!keep.has(n.tagName)) { walk(n, dst); continue; }
      const el = document.createElement(n.tagName === 'STRONG' ? 'B' : n.tagName);
      if (n.tagName === 'A') {
        const href = n.getAttribute('href') || '';
        if (/^https:\/\//i.test(href)) el.dataset.url = href;
      }
      walk(n, el);
      dst.appendChild(el);
    }
  };
  walk(doc.body.firstChild, out);
  out.querySelectorAll('b + br, ul + br, br + br').forEach((br) => br.remove());
  out.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim()) p.remove(); });
  return out.innerHTML;
}

// ---------- Data ----------
async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await invoke('settings_set', { value: state.settings }).catch((e) => banner('Couldn’t save settings', String(e)));
}

async function check({ manual = false } = {}) {
  const btn = $('#refresh-btn');
  btn.classList.add('spinning');
  const previous = recommended()?.version;
  try {
    state.detection = await invoke('detect');
    const gpu = state.detection.gpu;
    if (!gpu) { state.error = 'no-gpu'; return; }
    state.product = state.settings.productOverride
      || await invoke('resolve_product', { gpuName: gpu.name, notebook: state.detection.system.isNotebook });
    if (!state.product) { state.error = 'no-product'; return; }
    const args = { psid: state.product.psid, pfid: state.product.pfid, windows11: state.detection.system.isWindows11, count: 15 };
    const [gr, st] = await Promise.all([
      invoke('drivers', { ...args, studio: false }),
      invoke('drivers', { ...args, studio: true }).catch(() => [])
    ]);
    state.drivers = { gr: gr.map(tidy), st: st.map(tidy) };
    state.error = null;
    state.checkedAt = new Date();
    const now = recommended()?.version;
    if (previous && now && previous !== now) banner(`Driver ${now} is available`, `A new ${channelLabel(recommended())} was released ${relDate(recommended().releaseDate)}.`, 'ok');
    else if (manual) banner(updateAvailable() ? `Driver ${now} is available` : 'You’re up to date', `Checked NVIDIA for ${state.product.name} just now.`, 'ok');
    loadArtwork();
  } catch (e) {
    state.error = 'network';
    state.errorDetail = String(e);
  } finally {
    state.loading = false;
    btn.classList.remove('spinning');
    renderMe();
    renderNav();
    render();
  }
}

function loadArtwork() {
  for (const d of slides()) {
    if (d.articleUrl && !(d.articleUrl in state.articles)) {
      state.articles[d.articleUrl] = null;
      invoke('article', { url: d.articleUrl }).then((meta) => {
        state.articles[d.articleUrl] = meta;
        if (state.page === 'home') renderHero();
      });
    }
  }
  for (const d of slides()) {
    if (d.billboardUrl && !(d.billboardUrl in state.billboards)) {
      state.billboards[d.billboardUrl] = undefined;
      invoke('billboard', { url: d.billboardUrl }).then((src) => {
        state.billboards[d.billboardUrl] = src || null;
        if (state.page === 'home') renderHero();
      });
    }
  }
  // Studio notes list creative apps, which aren't on Steam.
  const games = new Set(slides().filter((d) => !d.isStudio).flatMap((d) => d.games));
  for (const name of games) {
    if (name in state.games) continue;
    state.games[name] = null;
    invoke('game_art', { name }).then((art) => {
      state.games[name] = art;
      if (state.page === 'home') { renderHero(); patch('#games-shelf', gamesShelf()); updateAllRowNavs(); }
    });
  }
}

async function refreshInstallers() {
  state.installers = await invoke('downloads_list').catch(() => []);
  if (state.page === 'downloads') renderPage();
  if (state.page === 'home') renderHero();
}

let autoTimer = null;
function scheduleAutoCheck() {
  clearInterval(autoTimer);
  if (!state.settings.autoCheck) return;
  autoTimer = setInterval(() => {
    const hours = state.settings.checkIntervalHours || 6;
    if (!state.checkedAt || Date.now() - state.checkedAt.getTime() >= hours * 3600000) check();
  }, 5 * 60000);
}

// ---------- Downloads & install ----------
async function getDriver(version, studio) {
  const d = findDriver(version, studio === undefined ? undefined : studio === 'true' || studio === true);
  if (!d) throw new Error(`Driver ${version} isn’t in the current list.`);
  return d;
}

async function primary(version, studio) {
  const d = await getDriver(version, studio);
  const inst = installerFor(d.version);
  if (inst) return openInstall(d, inst.path);
  startDownload(d.downloadUrl, d.version, true);
}

async function startDownload(url, version, installWhenDone) {
  try {
    await invoke('download_start', { url, version });
    state.pendingInstall = installWhenDone ? version : state.pendingInstall;
    state.download = { version, fileName: url.split('/').pop(), received: partialFor(version)?.size || 0, total: 0, bytesPerSec: 0, state: 'downloading' };
    updateDownloadUi();
  } catch (e) {
    banner('Couldn’t start the download', String(e));
  }
}

T.event.listen('download', async ({ payload: p }) => {
  state.download = p;
  if (p.state === 'cancelled') { state.download = null; state.pendingInstall = null; refreshInstallers(); }
  if (p.state === 'paused') refreshInstallers();
  if (p.state === 'error') {
    banner('Download stopped', p.message);
    state.download = null;
    refreshInstallers();
  }
  if (p.state === 'done') {
    await refreshInstallers();
    if (!p.verified) {
      banner('Installer signature not trusted', `The file isn’t signed by NVIDIA Corporation, so it won’t be installed. Signer: ${p.signer || 'none'}`);
    } else if (state.pendingInstall === p.version) {
      state.pendingInstall = null;
      const d = findDriver(p.version);
      if (d) openInstall(d, p.path);
    }
    state.download = null;
  }
  updateDownloadUi();
});

function updateDownloadUi() {
  const p = state.download;
  const badge = $('#dl-badge');
  if (p && p.total && ['downloading', 'paused'].includes(p.state)) {
    badge.hidden = false;
    badge.textContent = p.state === 'paused' ? 'Paused' : `${Math.floor((p.received / p.total) * 100)}%`;
  } else badge.hidden = true;
  if (state.page === 'home') patch('#hero-actions', heroActions(slides()[state.slide]));
  if (state.page === 'downloads') patch('#transfer', transferCard());
  if (['gameready', 'studio'].includes(state.page)) renderPage();
}

// ---------- Sheets ----------
function openSheet(html, { small = false, locked = false } = {}) {
  const el = $('#sheet');
  el.innerHTML = `<div class="sheet ${small ? 'small' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  el.hidden = false;
  el.dataset.locked = locked ? '1' : '';
  el.querySelector('[autofocus]')?.focus();
}
function closeSheet() {
  const el = $('#sheet');
  if (el.dataset.locked) return;
  el.hidden = true;
  el.innerHTML = '';
}

function openNotes(d) {
  const img = articleImage(d);
  const inst = installed();
  const isInstalled = inst && cmpVersion(d.version, inst) === 0;
  openSheet(`
    <header>
      <div class="eyebrow">${icon(d.isStudio ? 'brush' : 'gamepad')}${esc(channelLabel(d))}${d.branch ? ` · ${esc(d.branch)}` : ''}</div>
      <h3>Version ${esc(d.version)}</h3>
      <div class="note" style="color:var(--label-2)">Released ${esc(fmtDate(d.releaseDate))} · ${esc(d.size)}${d.isWhql ? ' · WHQL certified' : ''}${isInstalled ? ' · <span class="verified">Installed</span>' : ''}</div>
    </header>
    <div class="body">
      ${img ? `<img class="notes-banner" src="${esc(img)}" alt="">` : ''}
      <div class="notes">${sanitize(d.notesHtml)}${d.otherNotesHtml ? `<div style="color:var(--label-2)">${sanitize(d.otherNotesHtml)}</div>` : ''}</div>
    </div>
    <footer>
      <div class="left">
        ${d.releaseNotesPdf ? `<button class="btn" data-action="open" data-url="${esc(d.releaseNotesPdf)}">${icon('doc')}Release Notes</button>` : ''}
        <button class="btn" data-action="open" data-url="${esc(d.detailsUrl)}">${icon('external')}nvidia.com</button>
      </div>
      <button class="btn" data-action="close-sheet">Close</button>
      ${isInstalled ? '' : `<button class="btn blue" data-action="primary" data-version="${esc(d.version)}" data-studio="${d.isStudio}">${installerFor(d.version) ? 'Install' : 'Download & Install'}</button>`}
    </footer>`);
}

function openInstall(d, path, note = '') {
  const s = state.settings;
  const express = s.expressInstall;
  openSheet(`
    <header>
      <div class="eyebrow">${icon(d.isStudio ? 'brush' : 'gamepad')}${esc(channelLabel(d))}</div>
      <h3>Install driver ${esc(d.version)}</h3>
      <div style="color:var(--label-2)">Currently installed: ${esc(installed() || 'unknown')} · ${esc(state.detection.gpu.name)}</div>
    </header>
    <div class="body" id="install-body">
      ${note ? `<p style="color:var(--orange);margin-top:0">${esc(note)}</p>` : ''}
      <div class="choice ${express ? 'on' : ''}" data-action="install-mode" data-mode="express" role="radio" aria-checked="${express}" tabindex="0">
        <div class="radio"></div>
        <div><div class="title">Express</div><div class="note">Installs quietly with your current NVIDIA settings. Your screen may flicker or go dark for a moment.</div></div>
      </div>
      <div class="choice ${express ? '' : 'on'}" data-action="install-mode" data-mode="custom" role="radio" aria-checked="${!express}" tabindex="0">
        <div class="radio"></div>
        <div><div class="title">Custom</div><div class="note">Opens NVIDIA’s installer so you can choose components.</div></div>
      </div>
      <div class="cell" style="padding:8px 2px" ${express ? '' : 'hidden'} id="clean-row">
        <div class="grow"><div class="title">Clean installation</div><div class="note">Resets NVIDIA Control Panel settings to their defaults.</div></div>
        <label class="switch"><input type="checkbox" id="clean-toggle" ${s.cleanInstall ? 'checked' : ''}><span></span></label>
      </div>
      <p class="footnote" style="margin-top:10px">${icon('shield')} Signed by NVIDIA Corporation. Windows will ask for permission to make changes.</p>
    </div>
    <footer>
      <button class="btn" data-action="close-sheet">Cancel</button>
      <button class="btn blue" data-action="run-install" data-version="${esc(d.version)}" data-studio="${d.isStudio}" data-path="${esc(path)}" autofocus>Install</button>
    </footer>`, { small: true });
}

// ---------- Install progress, read from NVIDIA's own setup log ----------
const PACKAGE_LABELS = [
  [/^Display\.Driver/, 'graphics driver'],
  [/^HDAudio/, 'HD Audio driver'],
  [/^Display\.PhysX/, 'PhysX'],
  [/^Display\.NvApp|^NvCpl|^ShadowPlay/, 'NVIDIA App'],
  [/^VirtualAudio/, 'virtual audio driver'],
  [/^USBC/, 'USB-C driver'],
  [/^FrameView/, 'FrameView SDK'],
  [/^NvDLISR/, 'image scaling'],
  [/^MSVC/, 'Visual C++ runtime'],
  [/^Nv(Container|Telemetry|Plugin|Backend)/, 'NVIDIA services']
];
const packageLabel = (name) => PACKAGE_LABELS.find(([re]) => re.test(name || ''))?.[1] || name;

function phaseVerb(phase) {
  if (!phase || /^install/i.test(phase)) return 'Installing';
  if (/^(remove|delete|clear|stop|clean)/i.test(phase)) return 'Clearing old files for';
  if (/^(check|decide|get)/i.test(phase)) return 'Checking';
  return 'Setting up';
}

function fmtElapsed(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} elapsed`;
}

// Unpacking and checks are quick; NVIDIA's step counter covers the real install, so it gets most of the bar.
function installProgressView(p) {
  const run = state.installing || {};
  let title, detail, percent = null;
  if (p.stage === 'permission') {
    title = 'Waiting for permission';
    detail = 'Approve the Windows prompt to continue.';
  } else if (p.stage === 'unpacking') {
    title = 'Unpacking installer';
    detail = `${fmtBytes(p.unpackedBytes)} of about ${fmtBytes(run.expectedBytes)}`;
    percent = 10 * Math.min(1, p.unpackedBytes / run.expectedBytes);
  } else if (p.stage === 'InstallProgress') {
    const label = packageLabel(p.package);
    title = label ? `${phaseVerb(p.phase)} ${label}` : 'Installing';
    detail = p.package === 'Display.Driver' && /^install/i.test(p.phase || '')
      ? 'Your screen may flicker or go dark for a moment. This is the longest step.'
      : run.express ? 'Running quietly in the background.' : 'Follow the steps in NVIDIA’s installer.';
    percent = p.totalUnits ? 15 + 85 * Math.min(1, p.doneUnits / p.totalUnits) : 15;
  } else if (/finish|complete|reboot/i.test(p.stage)) {
    title = 'Finishing up';
    detail = 'Almost done.';
    percent = 100;
  } else {
    title = 'Checking your system';
    detail = 'Making sure this driver fits your PC.';
    percent = 12;
  }
  if (percent != null) {
    run.percent = Math.max(run.percent || 0, percent);
    percent = run.percent;
  }
  return `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
      <div class="title" style="font-weight:600">${esc(title)}</div>
      <div style="color:var(--label-2);font-variant-numeric:tabular-nums">${percent == null ? '' : `${Math.floor(percent)}%`}</div>
    </div>
    <div class="meter install-meter ${percent == null ? 'indeterminate' : ''}"><i style="width:${percent ?? 30}%"></i></div>
    <div style="display:flex;justify-content:space-between;gap:12px;color:var(--label-2);font-size:12px;margin-top:8px">
      <span>${esc(detail)}</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums">${fmtElapsed(p.elapsedSecs || 0)}</span>
    </div>`;
}

T.event.listen('install-progress', ({ payload }) => {
  if (state.installing) patch('#install-progress', installProgressView(payload));
});

async function runInstall(version, studio, path) {
  const d = await getDriver(version, studio);
  const express = state.settings.expressInstall;
  const clean = express && $('#clean-toggle')?.checked;
  await saveSettings({ cleanInstall: !!$('#clean-toggle')?.checked });
  const before = installed();
  state.installing = { version: d.version, expectedBytes: (state.installers.find((i) => i.path === path)?.size || 1e9) * 4, percent: 0, express };
  openSheet(`
    <div class="body" style="padding:26px 26px 22px">
      <h3 style="font:700 18px var(--font-display);margin:0 0 14px">Installing ${esc(d.version)}</h3>
      <div id="install-progress">${installProgressView({ stage: 'permission', elapsedSecs: 0 })}</div>
    </div>`, { small: true, locked: true });
  let result;
  try {
    result = await invoke('install', { path, express, clean });
  } catch (e) {
    state.installing = false;
    $('#sheet').dataset.locked = '';
    return openInstall(d, path, String(e));
  }
  state.installing = false;
  $('#sheet').dataset.locked = '';
  if (result.cancelled) return openInstall(d, path, 'Installation was cancelled in the Windows prompt.');
  state.detection = await invoke('detect');
  const now = installed();
  const ok = now && cmpVersion(now, d.version) === 0;
  if (ok && state.settings.deleteAfterInstall) await invoke('download_delete', { path }).catch(() => {});
  refreshInstallers();
  render();
  openSheet(`
    <div class="body center" style="padding:30px 26px 10px">
      <div style="color:${ok ? 'var(--green)' : 'var(--orange)'}">${icon(ok ? 'check' : 'warn').replace('class="i"', 'class="i" style="width:44px;height:44px;stroke-width:1.5"')}</div>
      <h3 style="font:700 18px var(--font-display);margin:10px 0 6px">${ok ? `Driver ${esc(d.version)} is installed` : 'Installer finished'}</h3>
      <div style="color:var(--label-2)">${ok
        ? `Updated from ${esc(before || 'the previous driver')}.${result.code ? ' Restart your PC to finish setting up.' : ''}`
        : `The active driver is still ${esc(now || 'unknown')}${result.code != null ? ` (installer exit code ${esc(result.code)})` : ''}. Restart your PC, then check again.`}</div>
    </div>
    <footer><button class="btn blue" data-action="close-sheet" autofocus>Done</button></footer>`, { small: true });
}

function confirmDelete(path, name) {
  openSheet(`
    <div class="body" style="padding:24px 22px 8px">
      <h3 style="font:700 17px var(--font-display);margin:0 0 6px">Delete this installer?</h3>
      <div style="color:var(--label-2)">${esc(name)} will be removed from your Downloads folder. You can download it again anytime.</div>
    </div>
    <footer>
      <button class="btn" data-action="close-sheet" autofocus>Cancel</button>
      <button class="btn blue" style="background:var(--red)" data-action="do-delete" data-path="${esc(path)}">Delete</button>
    </footer>`, { small: true });
}

// ---------- Rendering ----------
function patch(sel, html) {
  const el = $(sel);
  if (el) el.innerHTML = html;
}

function banner(title, note, kind = 'warn') {
  const el = $('#banner');
  el.innerHTML = `<div class="banner ${kind}" role="status">${icon(kind === 'ok' ? 'check' : 'warn')}<div class="grow"><b>${esc(title)}</b><div class="note">${esc(note || '')}</div></div><button class="icon-btn" data-action="dismiss-banner" aria-label="Dismiss">${icon('x')}</button></div>`;
  clearTimeout(banner.t);
  banner.t = setTimeout(() => { el.innerHTML = ''; }, 7000);
}

function renderMe() {
  const s = state.detection?.system;
  if (!s) return;
  const name = s.displayName || s.userName || 'This PC';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  $('#me').innerHTML = `${s.avatar ? `<img src="${s.avatar}" alt="">` : `<span class="initials">${esc(initials)}</span>`}<div style="min-width:0">${esc(name)}<small>${esc(s.computerName)}</small></div>`;
}

function renderNav() {
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === state.page));
  $('#home-dot').hidden = !updateAvailable();
}

function render() {
  renderNav();
  renderPage();
}

function renderPage() {
  const pages = { home: homePage, search: searchPage, downloads: downloadsPage, gameready: () => releasesPage(false), studio: () => releasesPage(true), gpu: gpuPage, settings: settingsPage };
  $('#page').innerHTML = (pages[state.page] || homePage)();
  if (state.page === 'home') { renderHero(); updateAllRowNavs(); }
  if (state.page === 'search') {
    const input = $('#search-input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    runSearch();
  }
}

function navigate(page) {
  if (state.page === page) return;
  state.page = page;
  $('#content').scrollTop = 0;
  render();
  stopTelemetry();
  if (page === 'gpu') startTelemetry();
  if (page === 'downloads') refreshInstallers();
}

function problemState() {
  if (state.loading) return null;
  const msgs = {
    'no-gpu': ['cpu', 'No NVIDIA graphics card found', 'Driver Updater couldn’t find an NVIDIA GPU in this PC. If one is installed, make sure it’s enabled in Device Manager.', ''],
    'no-product': ['search', 'Choose your graphics card', `NVIDIA’s catalog doesn’t list “${state.detection?.gpu?.name}” by that exact name. Search for your card to continue.`, '<button class="btn blue" data-page="search">Search Graphics Cards</button>'],
    network: ['warn', 'Can’t reach NVIDIA', `Check your internet connection and try again. ${state.errorDetail || ''}`, '<button class="btn blue" data-action="refresh">Try Again</button>']
  };
  const m = msgs[state.error];
  if (!m) return null;
  return `<div class="page-pad"><div class="empty">${icon(m[0])}<h3>${esc(m[1])}</h3><p>${esc(m[2])}</p>${m[3]}</div></div>`;
}

// Home
function homePage() {
  const problem = problemState();
  if (problem) return problem;
  if (state.loading || !slides().length) {
    return `<section class="hero"><div class="hero-body" style="width:420px">
      <div class="skeleton" style="height:12px;width:150px"></div>
      <div class="skeleton" style="height:58px;width:260px;margin:14px 0"></div>
      <div class="skeleton" style="height:12px;width:340px"></div>
      <div class="skeleton" style="height:12px;width:280px;margin-top:8px"></div>
      <div class="skeleton" style="height:36px;width:180px;margin-top:22px;border-radius:18px"></div></div></section>`;
  }
  return `
    <section class="hero" id="hero"></section>
    <section class="shelf" id="games-shelf">${gamesShelf()}</section>
    <section class="shelf">
      <h2>Your System <small>${esc(state.detection.gpu.name)}</small></h2>
      <div class="stats">${systemStats()}</div>
    </section>
    <section class="shelf">
      <h2>Recent Releases <small>${esc(state.product.name)} · ${state.detection.system.isWindows11 ? 'Windows 11' : 'Windows 10'}</small></h2>
      ${scroller([...state.drivers.gr.slice(0, 6), ...state.drivers.st.slice(0, 3)]
        .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
        .map(releaseCard).join(''), 'releases')}
    </section>
    <div style="height:24px"></div>`;
}

function renderHero() {
  const el = $('#hero');
  if (!el) return;
  const list = slides();
  state.slide = Math.min(state.slide, list.length - 1);
  const d = list[state.slide];
  if (!d) return;
  const img = heroImage(d);
  const inst = installed();
  const games = d.isStudio ? [] : d.games.map((g) => state.games[g]).filter((g) => g?.image);
  const statusWarn = updateAvailable();
  const prevImg = el.querySelector('.hero-img');
  const keepImg = img && prevImg && prevImg.dataset.src === img.src;
  el.innerHTML = `
    ${img ? `<img class="hero-img ${img.billboard ? 'billboard' : ''} ${keepImg ? 'loaded' : ''}" data-src="${esc(img.src)}" src="${esc(img.src)}" alt="" onload="this.classList.add('loaded')">` : ''}
    <div class="hero-status ${statusWarn ? 'warn' : ''}"><span class="led"></span>${statusWarn ? 'Update available' : 'Up to date'} · Installed ${esc(inst || '—')}</div>
    <div class="hero-body">
      <div class="eyebrow">${icon(d.isStudio ? 'brush' : 'gamepad')}${esc(channelLabel(d))}</div>
      <h1>${esc(d.version)}</h1>
      <div class="meta">
        <span>${d.isStudio ? 'Studio' : 'Game Ready'}</span><span class="sep">•</span>
        <span>${esc(fmtDate(d.releaseDate))}</span><span class="sep">•</span>
        <span>${esc(d.size)}</span>
        ${d.isWhql ? '<span class="box">WHQL</span>' : ''}${d.branch ? `<span class="box">${esc(d.branch)}</span>` : ''}
      </div>
      <p class="desc">${esc(summary(d))}</p>
      ${d.games.length ? `<div class="faces">
        ${games.length ? `<div class="stack">${games.slice(0, 4).map((g) => `<img src="${esc(g.image)}" alt="">`).join('')}</div>` : ''}
        <span>${esc(gamesLine(d))}</span></div>` : ''}
      <div class="actions" id="hero-actions">${heroActions(d)}</div>
    </div>
    ${list.length > 1 ? `<div class="dots">${list.map((_, i) => `<button class="${i === state.slide ? 'on' : ''}" data-action="slide" data-index="${i}" aria-label="Show ${esc(channelLabel(list[i]))}"></button>`).join('')}</div>` : ''}`;
}

function gamesLine(d) {
  const lead = d.isStudio ? 'Optimized for' : 'Game Ready for';
  if (d.games.length <= 2) return `${lead} ${d.games.join(' and ')}`;
  return `${lead} ${d.games.slice(0, 2).join(', ')} and ${d.games.length - 2} more`;
}

function heroActions(d) {
  if (!d) return '';
  const inst = installed();
  const cmp = inst ? cmpVersion(d.version, inst) : 1;
  const p = state.download;
  const notesBtn = `<button class="circle" data-action="notes" data-version="${esc(d.version)}" data-studio="${d.isStudio}" title="Release notes" aria-label="Release notes">${icon('info')}</button>`;
  if (p && p.version === d.version && ['downloading', 'paused', 'verifying'].includes(p.state)) {
    const pct = p.total ? (p.received / p.total) * 100 : 0;
    const label = p.state === 'verifying' ? 'Verifying signature…' : p.state === 'paused' ? `Paused · ${Math.floor(pct)}%` : `Downloading · ${Math.floor(pct)}%`;
    return `<button class="pill progress" data-page="downloads"><span class="bar" style="width:${pct}%"></span><span class="lbl">${label}</span></button>${notesBtn}`;
  }
  let main;
  if (cmp === 0) main = `<button class="pill done" disabled>${icon('check')}Installed</button>`;
  else if (installerFor(d.version)) main = `<button class="pill primary" data-action="primary" data-version="${esc(d.version)}" data-studio="${d.isStudio}">${icon('shield')}Install ${esc(d.version)}</button>`;
  else if (cmp > 0) main = `<button class="pill primary" data-action="primary" data-version="${esc(d.version)}" data-studio="${d.isStudio}">${icon('download')}Update to ${esc(d.version)}</button>`;
  else main = `<button class="pill done" data-action="primary" data-version="${esc(d.version)}" data-studio="${d.isStudio}">${icon('download')}Download ${esc(d.version)}</button>`;
  return main + notesBtn;
}

function gamesShelf() {
  const d = slides().find((x) => x.games.length);
  if (!d) return '';
  return `<h2>Game Ready For <small>Optimized in ${esc(d.version)}</small></h2>
    ${scroller(d.games.map((name) => {
      const g = state.games[name];
      const art = g === null || g === undefined
        ? '<div class="skeleton" style="position:absolute;inset:0;border-radius:0"></div>'
        : g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : `<div class="fallback">${esc(name)}</div>`;
      const sub = g?.description ? g.description : 'Steam artwork unavailable';
      return `<div class="tile" ${g?.storeUrl ? `data-action="open" data-url="${esc(g.storeUrl)}" title="Open in Steam"` : ''}>
        <div class="art">${art}</div>
        <div class="name">${esc(g?.name || name)}</div>
        <div class="sub">${esc(g ? sub : 'Loading…')}</div></div>`;
    }).join(''), 'games')}`;
}

// Horizontal shelf with TV-app style arrows; a mouse wheel can't scroll sideways on its own.
function scroller(items, label) {
  return `<div class="row-wrap" data-at-start="true">
    <button class="row-nav prev" data-action="row-scroll" data-dir="-1" aria-label="Scroll ${label} left"><svg class="i" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>
    <div class="row">${items}</div>
    <button class="row-nav next" data-action="row-scroll" data-dir="1" aria-label="Scroll ${label} right">${icon('chevron')}</button>
  </div>`;
}

function updateRowNav(row) {
  const wrap = row.closest('.row-wrap');
  if (!wrap) return;
  wrap.dataset.atStart = row.scrollLeft <= 4;
  wrap.dataset.atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
}

function updateAllRowNavs() {
  document.querySelectorAll('.row-wrap .row').forEach(updateRowNav);
}

document.addEventListener('scroll', (e) => { if (e.target.classList?.contains('row')) updateRowNav(e.target); }, true);
window.addEventListener('resize', updateAllRowNavs);

function systemStats() {
  const g = state.detection.gpu;
  const s = state.detection.system;
  const vram = g.memoryTotalMib ? `${(g.memoryTotalMib / 1024).toFixed(0)}<small> GB</small>` : '—';
  return [
    ['cpu', 'Graphics', esc(g.name.replace(/^NVIDIA\s+(GeForce\s+)?/, ''))],
    ['shield', 'Installed driver', `${esc(g.driverVersion || '—')}`],
    ['clock', 'Driver date', s.driverDate ? `${esc(fmtDate(s.driverDate).replace(/, \d{4}$/, ''))}<small> ${s.driverDate.slice(0, 4)}</small>` : '—'],
    ['memory', 'Video memory', vram],
    ['thermo', 'Temperature', g.temperatureC != null ? `${g.temperatureC}<small> °C</small>` : '—'],
    ['gauge', 'Windows', esc(`${s.isWindows11 ? '11' : '10'} · ${s.osBuild}`)]
  ].map(([i, k, v]) => `<div class="stat"><div class="k">${icon(i)}${k}</div><div class="val">${v}</div></div>`).join('');
}

function releaseCard(d) {
  const inst = installed();
  const tag = inst && cmpVersion(d.version, inst) === 0 ? '<span class="tag installed">Installed</span>'
    : d === state.drivers.gr[0] || d === state.drivers.st[0] ? '<span class="tag new">Latest</span>' : '';
  return `<button class="release-card" data-action="notes" data-version="${esc(d.version)}" data-studio="${d.isStudio}">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="v">${esc(d.version)}</span>${tag}</div>
    <div class="t">${d.isStudio ? 'Studio' : 'Game Ready'} · ${esc(fmtDate(d.releaseDate))}</div>
    <div class="h">${esc(d.headline)}</div></button>`;
}

// Releases list
function releasesPage(studio) {
  const problem = problemState();
  if (problem) return problem;
  const list = studio ? state.drivers.st : state.drivers.gr;
  const title = studio ? 'Studio Drivers' : 'Game Ready Drivers';
  const sub = studio
    ? 'Tested with creative apps like Adobe, Autodesk and Blender for stability.'
    : 'Tuned for the newest games on release day.';
  if (state.loading) return `<div class="page-pad"><h1 class="large-title">${title}</h1><p class="subtitle">${sub}</p><div class="skeleton" style="height:300px"></div></div>`;
  if (!list.length) return `<div class="page-pad"><h1 class="large-title">${title}</h1><div class="empty">${icon('info')}<h3>No ${title} for this card</h3><p>NVIDIA doesn’t publish this driver type for ${esc(state.product?.name)}.</p></div></div>`;
  const inst = installed();
  return `<div class="page-pad">
    <h1 class="large-title">${title}</h1>
    <p class="subtitle">${sub} Showing releases for ${esc(state.product.name)}.</p>
    <div class="group">${list.map((d, i) => {
      const isInst = inst && cmpVersion(d.version, inst) === 0;
      const p = state.download;
      const busy = p && p.version === d.version && ['downloading', 'paused', 'verifying'].includes(p.state);
      const action = isInst ? '<span class="tag installed">Installed</span>'
        : busy ? `<button class="btn" data-page="downloads">${p.state === 'paused' ? 'Paused' : `${Math.floor((p.received / (p.total || 1)) * 100)}%`}</button>`
        : installerFor(d.version) ? `<button class="btn blue" data-action="primary" data-version="${esc(d.version)}" data-studio="${d.isStudio}">Install</button>`
        : `<button class="btn" data-action="primary" data-version="${esc(d.version)}" data-studio="${d.isStudio}">${icon('download')}${cmpVersion(d.version, inst) < 0 ? 'Roll back' : 'Get'}</button>`;
      return `<div class="cell clickable release-row" data-action="notes" data-version="${esc(d.version)}" data-studio="${d.isStudio}">
        <div class="ver">${esc(d.version)}<small>${esc(fmtDate(d.releaseDate))}</small></div>
        <div style="min-width:0"><div class="hl">${esc(d.headline)}</div>
          <div class="ml"><span>${esc(d.size)}</span>${d.branch ? `<span>${esc(d.branch)}</span>` : ''}${d.isWhql ? '<span>WHQL</span>' : ''}${i === 0 ? '<span class="tag new">Latest</span>' : ''}</div></div>
        <div style="display:flex;gap:6px;align-items:center">${action}</div></div>`;
    }).join('')}</div>
    <p class="footnote">Rolling back installs an older driver over the current one. NVIDIA recommends the latest release unless a specific version fixes a problem for you.</p>
  </div>`;
}

// Downloads
function transferCard() {
  const p = state.download;
  if (!p || !['downloading', 'paused', 'verifying'].includes(p.state)) return '';
  const pct = p.total ? (p.received / p.total) * 100 : 0;
  const left = p.bytesPerSec ? fmtDuration((p.total - p.received) / p.bytesPerSec) : '';
  const line = p.state === 'verifying' ? 'Checking NVIDIA’s digital signature…'
    : p.state === 'paused' ? `Paused — ${fmtBytes(p.received)} of ${fmtBytes(p.total)}`
    : `${fmtBytes(p.received)} of ${fmtBytes(p.total)}${p.bytesPerSec ? ` · ${fmtBytes(p.bytesPerSec)}/s` : ''}${left ? ` · ${left}` : ''}`;
  const controls = p.state === 'verifying' ? ''
    : `${p.state === 'paused'
      ? `<button class="icon-btn" data-action="resume" data-version="${esc(p.version)}" title="Resume" aria-label="Resume">${icon('play')}</button>`
      : `<button class="icon-btn" data-action="pause" title="Pause" aria-label="Pause">${icon('pause')}</button>`}
      <button class="icon-btn danger" data-action="cancel-download" title="Cancel" aria-label="Cancel">${icon('x')}</button>`;
  return `<div class="group-title">In Progress</div><div class="transfer">
    <div class="glyph">${icon('download')}</div>
    <div style="min-width:0"><div class="title" style="font-weight:600">Driver ${esc(p.version)}</div>
      <div class="meter"><i style="width:${pct}%"></i></div>
      <div class="stats-line">${esc(line)}</div></div>
    <div style="display:flex;gap:4px">${controls}</div></div>`;
}

function downloadsPage() {
  const p = state.download;
  const files = state.installers.filter((i) => !(p && i.partial && i.version === p.version));
  return `<div class="page-pad">
    <h1 class="large-title">Downloads</h1>
    <p class="subtitle">Installers are saved to Downloads › NVIDIA Drivers and checked against NVIDIA’s digital signature.</p>
    <div id="transfer">${transferCard()}</div>
    <div class="group-title" style="display:flex;justify-content:space-between;align-items:center">Installers
      <button class="btn" data-action="reveal-folder" style="text-transform:none;letter-spacing:0">${icon('folder')}Show in Explorer</button></div>
    ${files.length ? `<div class="group">${files.map((f) => {
      const d = findDriver(f.version);
      const inst = installed();
      const isInst = inst && cmpVersion(f.version, inst) === 0;
      const sub = f.partial ? `Incomplete · ${fmtBytes(f.size)} downloaded` : `${fmtBytes(f.size)} · ${new Date(f.modified * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      const main = f.partial
        ? (p && p.version === f.version && p.state === 'paused') ? '' : `<button class="btn" data-action="resume-file" data-url="${esc(f.url)}" data-version="${esc(f.version)}">${icon('play')}Resume</button>`
        : isInst ? '<span class="tag installed">Installed</span>'
        : d ? `<button class="btn blue" data-action="primary" data-version="${esc(f.version)}" data-studio="${d.isStudio}">Install</button>` : '';
      return `<div class="cell">
        <div class="file-glyph ${f.partial ? 'partial' : ''}">${icon(f.partial ? 'clock' : 'shield')}</div>
        <div class="grow"><div class="title">${esc(d ? `${channelLabel(d)} ${f.version}` : f.fileName)}</div><div class="note">${esc(sub)}</div></div>
        ${main}
        ${f.partial ? '' : `<button class="icon-btn" data-action="reveal" data-path="${esc(f.path)}" title="Show in Explorer" aria-label="Show in Explorer">${icon('folder')}</button>`}
        <button class="icon-btn danger" data-action="delete" data-path="${esc(f.path)}" data-name="${esc(f.fileName)}" title="Delete" aria-label="Delete">${icon('trash')}</button></div>`;
    }).join('')}</div>`
    : `<div class="empty" style="padding:40px">${icon('download')}<h3>No installers yet</h3><p>Drivers you download appear here so you can reinstall or roll back without downloading again.</p></div>`}
  </div>`;
}

// Search
function searchPage() {
  return `<div class="page-pad">
    <h1 class="large-title">Search</h1>
    <p class="subtitle">Find a driver by version, game or fix — or look up any NVIDIA graphics card.</p>
    <label class="search-field">${icon('search')}<input id="search-input" placeholder="Try “Cyberpunk”, “617” or “RTX 4070”" value="${esc(state.query)}" spellcheck="false"></label>
    <div id="search-results"></div></div>`;
}

let searchSeq = 0;
async function runSearch() {
  const q = state.query.trim().toLowerCase();
  const out = $('#search-results');
  if (!out) return;
  if (!q) {
    out.innerHTML = `<div class="group-title">Graphics card in use</div><div class="group"><div class="cell"><div class="grow"><div class="title">${esc(state.product?.name || state.detection?.gpu?.name || 'Unknown')}</div><div class="note">${esc(state.product?.series || '')}${state.settings.productOverride ? ' · chosen manually' : ' · detected automatically'}</div></div>${state.settings.productOverride ? '<button class="btn" data-action="clear-product">Use Detected Card</button>' : ''}</div></div>`;
    return;
  }
  const seq = ++searchSeq;
  const drivers = allDrivers().filter((d) => [d.version, d.headline, d.games.join(' '), d.notesHtml.replace(/<[^>]+>/g, ' ')].join(' ').toLowerCase().includes(q));
  const products = q.length >= 2 ? await invoke('search_products', { query: q }).catch(() => []) : [];
  if (seq !== searchSeq) return;
  const driverHtml = drivers.length ? `<div class="group-title">Drivers</div><div class="group">${drivers.map((d) => `
      <div class="cell clickable" data-action="notes" data-version="${esc(d.version)}" data-studio="${d.isStudio}">
        <div class="grow"><div class="title">${esc(channelLabel(d))} ${esc(d.version)}</div><div class="note">${esc(fmtDate(d.releaseDate))} · ${esc(d.headline)}</div></div>${icon('chevron')}</div>`).join('')}</div>` : '';
  const productHtml = products.length ? `<div class="group-title">Graphics Cards</div><div class="group">${products.map((p) => {
      const current = state.product && p.pfid === state.product.pfid && p.psid === state.product.psid;
      return `<div class="cell"><div class="grow"><div class="title">${esc(p.name)}</div><div class="note">${esc(p.series)}</div></div>
        ${current ? '<span class="tag installed">In use</span>' : `<button class="btn" data-action="use-product" data-pfid="${p.pfid}" data-psid="${p.psid}" data-name="${esc(p.name)}" data-series="${esc(p.series)}">Use This Card</button>`}</div>`;
    }).join('')}</div><p class="footnote">Choosing a card changes which drivers are offered. Use your detected card unless detection picked the wrong model.</p>` : '';
  out.innerHTML = driverHtml + productHtml || `<div class="empty">${icon('search')}<h3>No Results</h3><p>Nothing matches “${esc(state.query)}”.</p></div>`;
}

// My GPU
let telemetryTimer = null;
function startTelemetry() {
  const tick = async () => {
    const t = await invoke('telemetry').catch(() => null);
    if (t) { state.telemetry = t; if (state.page === 'gpu') patch('#live', liveTiles()); }
  };
  tick();
  telemetryTimer = setInterval(tick, 2000);
}
function stopTelemetry() { clearInterval(telemetryTimer); telemetryTimer = null; }

function liveTiles() {
  const t = state.telemetry || state.detection?.gpu || {};
  const tile = (i, k, v, unit, pct, hot) => `<div class="stat"><div class="k">${icon(i)}${k}</div><div class="val">${v ?? '—'}${v != null ? `<small> ${unit}</small>` : ''}</div>${pct != null ? `<div class="meter ${hot ? 'hot' : ''}"><i style="width:${Math.min(100, Math.max(0, pct))}%"></i></div>` : ''}</div>`;
  const memPct = t.memoryTotalMib ? (t.memoryUsedMib / t.memoryTotalMib) * 100 : null;
  return [
    tile('thermo', 'Temperature', t.temperatureC, '°C', t.temperatureC, t.temperatureC >= 80),
    tile('gauge', 'GPU load', t.utilization, '%', t.utilization),
    tile('memory', 'Video memory', t.memoryUsedMib != null ? (t.memoryUsedMib / 1024).toFixed(1) : null, `of ${((t.memoryTotalMib || 0) / 1024).toFixed(0)} GB`, memPct, memPct > 90),
    tile('bolt', 'Power draw', t.powerW != null ? Math.round(t.powerW) : null, 'W'),
    tile('cpu', 'Graphics clock', t.clockMhz, 'MHz'),
    tile('fan', 'Fan speed', t.fanPercent, '%', t.fanPercent)
  ].join('');
}

function gpuPage() {
  const det = state.detection;
  if (!det?.gpu) return problemState() || '<div class="page-pad"><div class="skeleton" style="height:300px"></div></div>';
  const g = det.gpu;
  const s = det.system;
  const row = (k, v) => `<div class="cell"><div class="grow">${k}</div><div class="val" style="user-select:text">${esc(v || '—')}</div></div>`;
  return `<div class="page-pad">
    <h1 class="large-title">${esc(g.name.replace(/^NVIDIA\s+/, ''))}</h1>
    <p class="subtitle">Live readings from nvidia-smi, updated every two seconds.</p>
    <div class="stats" id="live" style="padding:0">${liveTiles()}</div>
    <div class="group-title">Driver</div>
    <div class="group">${row('Installed version', g.driverVersion)}${row('Driver date', s.driverDate && fmtDate(s.driverDate))}${row('Latest Game Ready', state.drivers.gr[0]?.version)}${row('Latest Studio', state.drivers.st[0]?.version)}${row('NVIDIA catalog match', state.product ? `${state.product.name} — ${state.product.series}` : '')}</div>
    <div class="group-title">Hardware</div>
    <div class="group">${row('Graphics card', g.name)}${row('Video BIOS', g.vbios)}${row('PCI device ID', g.deviceId)}${row('Processor', s.cpu)}${row('Form factor', s.isNotebook ? 'Laptop' : 'Desktop')}</div>
    <div class="group-title">Windows</div>
    <div class="group">${row('Edition', s.osName)}${row('Build', String(s.osBuild || ''))}${row('Computer name', s.computerName)}</div>
  </div>`;
}

// Settings
function settingsPage() {
  const s = state.settings;
  const sw = (key, label, note) => `<div class="cell"><div class="grow"><div class="title">${label}</div>${note ? `<div class="note">${note}</div>` : ''}</div>
    <label class="switch"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}><span></span></label></div>`;
  return `<div class="page-pad" style="max-width:720px">
    <h1 class="large-title">Settings</h1>
    <div class="group-title">Updates</div>
    <div class="group">
      <div class="cell"><div class="grow"><div class="title">Driver type</div><div class="note">Game Ready targets new games. Studio favors stability in creative apps.</div></div>
        <div class="segmented" role="radiogroup">
          <button class="${s.channel !== 'studio' ? 'on' : ''}" data-action="channel" data-value="game-ready" role="radio" aria-checked="${s.channel !== 'studio'}">Game Ready</button>
          <button class="${s.channel === 'studio' ? 'on' : ''}" data-action="channel" data-value="studio" role="radio" aria-checked="${s.channel === 'studio'}">Studio</button>
        </div></div>
      ${sw('autoCheck', 'Check for updates automatically', 'While Driver Updater is open.')}
      <div class="cell"><div class="grow"><div class="title">Check every</div></div>
        <select class="popup" data-setting-select="checkIntervalHours" ${s.autoCheck ? '' : 'disabled'}>
          ${[[1, 'Hour'], [6, '6 Hours'], [24, 'Day']].map(([v, l]) => `<option value="${v}" ${s.checkIntervalHours === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      <div class="cell"><div class="grow"><div class="title">Last checked</div></div><div class="val">${state.checkedAt ? state.checkedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Never'}</div>
        <button class="btn" data-action="refresh">Check Now</button></div>
    </div>
    <div class="group-title">Installation</div>
    <div class="group">
      ${sw('expressInstall', 'Express installation', 'Install silently. Turn off to use NVIDIA’s installer and choose components.')}
      ${sw('cleanInstall', 'Clean installation', 'Reset NVIDIA Control Panel settings when installing.')}
      ${sw('deleteAfterInstall', 'Delete installer after installing', 'Frees about 1 GB per driver. Keep installers to roll back offline.')}
    </div>
    <div class="group-title">Graphics Card</div>
    <div class="group">
      <div class="cell"><div class="grow"><div class="title">Detected</div></div><div class="val">${esc(state.detection?.gpu?.name || 'None')}</div></div>
      <div class="cell"><div class="grow"><div class="title">Drivers offered for</div><div class="note">${esc(state.product?.series || '')}${s.productOverride ? ' · chosen manually' : ''}</div></div>
        <div class="val">${esc(state.product?.name || '—')}</div>
        ${s.productOverride ? '<button class="btn" data-action="clear-product">Reset</button>' : '<button class="btn" data-page="search">Change…</button>'}</div>
    </div>
    <div class="group-title">Storage</div>
    <div class="group"><div class="cell"><div class="grow"><div class="title">Download folder</div><div class="note">Downloads › NVIDIA Drivers</div></div>
      <button class="btn" data-action="reveal-folder">${icon('folder')}Show in Explorer</button></div></div>
    <div class="group-title">About</div>
    <div class="group">
      <div class="cell"><div class="grow">Driver Updater</div><div class="val">Version 1.0.0</div></div>
      <div class="cell"><div class="grow">Driver data</div><div class="val">NVIDIA driver download service</div></div>
      <div class="cell"><div class="grow">Game artwork</div><div class="val">Steam store</div></div>
    </div>
    <p class="footnote">Not affiliated with NVIDIA. GeForce, Game Ready and Studio are trademarks of NVIDIA Corporation.</p>
  </div>`;
}

// ---------- Events ----------
const actions = {
  'win-close': () => appWindow.close(),
  'win-min': () => appWindow.minimize(),
  'win-max': () => appWindow.toggleMaximize(),
  refresh: () => check({ manual: true }),
  'dismiss-banner': () => { $('#banner').innerHTML = ''; },
  'close-sheet': closeSheet,
  slide: (el) => { state.slide = Number(el.dataset.index); renderHero(); },
  'row-scroll': (el) => {
    const row = el.parentElement.querySelector('.row');
    row.scrollBy({ left: Number(el.dataset.dir) * row.clientWidth * 0.85, behavior: 'smooth' });
  },
  notes: async (el) => openNotes(await getDriver(el.dataset.version, el.dataset.studio)),
  primary: (el) => { closeSheet(); primary(el.dataset.version, el.dataset.studio).catch((e) => banner('Something went wrong', String(e))); },
  open: (el) => invoke('open_url', { url: el.dataset.url }),
  pause: () => invoke('download_pause'),
  resume: (el) => {
    const d = findDriver(el.dataset.version);
    const part = partialFor(el.dataset.version);
    const url = d?.downloadUrl || part?.url;
    if (url) startDownload(url, el.dataset.version, state.pendingInstall === el.dataset.version);
  },
  'resume-file': (el) => startDownload(el.dataset.url, el.dataset.version, false),
  'cancel-download': () => invoke('download_cancel'),
  reveal: (el) => invoke('reveal', { path: el.dataset.path }),
  'reveal-folder': () => invoke('reveal', { path: null }),
  delete: (el) => confirmDelete(el.dataset.path, el.dataset.name),
  'do-delete': async (el) => {
    closeSheet();
    await invoke('download_delete', { path: el.dataset.path }).catch((e) => banner('Couldn’t delete the installer', String(e)));
    refreshInstallers();
  },
  'install-mode': async (el) => {
    await saveSettings({ expressInstall: el.dataset.mode === 'express' });
    document.querySelectorAll('.choice').forEach((c) => { const on = c === el; c.classList.toggle('on', on); c.setAttribute('aria-checked', on); });
    $('#clean-row').hidden = el.dataset.mode !== 'express';
  },
  'run-install': (el) => runInstall(el.dataset.version, el.dataset.studio, el.dataset.path).catch((e) => banner('Install failed', String(e))),
  channel: async (el) => { await saveSettings({ channel: el.dataset.value }); state.slide = 0; render(); },
  'use-product': async (el) => {
    await saveSettings({ productOverride: { pfid: Number(el.dataset.pfid), psid: Number(el.dataset.psid), name: el.dataset.name, series: el.dataset.series } });
    state.loading = true;
    navigate('home');
    check();
  },
  'clear-product': async () => { await saveSettings({ productOverride: null }); state.loading = true; navigate('home'); check(); }
};

document.addEventListener('click', (e) => {
  const link = e.target.closest('.notes a[data-url]');
  if (link) { e.preventDefault(); invoke('open_url', { url: link.dataset.url }); return; }
  if (e.target.id === 'sheet') { closeSheet(); return; }
  const a = e.target.closest('[data-action]');
  if (a && !a.disabled) { actions[a.dataset.action]?.(a); return; }
  const nav = e.target.closest('[data-page]');
  if (nav) { closeSheet(); navigate(nav.dataset.page); }
});

document.addEventListener('change', async (e) => {
  const key = e.target.dataset.setting;
  if (key) {
    await saveSettings({ [key]: e.target.checked });
    if (key === 'autoCheck') { scheduleAutoCheck(); renderPage(); }
  }
  const sel = e.target.dataset.settingSelect;
  if (sel) { await saveSettings({ [sel]: Number(e.target.value) }); scheduleAutoCheck(); }
});

let searchTimer = null;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'search-input') return;
  state.query = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 160);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); check({ manual: true }); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); navigate('search'); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('choice')) { e.preventDefault(); e.target.click(); }
  if (state.page === 'home' && $('#sheet').hidden && document.activeElement?.tagName !== 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const n = slides().length;
    if (n > 1) { state.slide = (state.slide + (e.key === 'ArrowRight' ? 1 : n - 1)) % n; renderHero(); }
  }
});
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, .notes, .val')) e.preventDefault(); });

// ---------- Boot ----------
(async function boot() {
  document.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
  render();
  try {
    state.settings = await invoke('settings_get');
  } catch {
    state.settings = { channel: 'game-ready', autoCheck: true, checkIntervalHours: 6, expressInstall: true, cleanInstall: false, deleteAfterInstall: false, productOverride: null };
  }
  await Promise.all([check(), refreshInstallers()]);
  scheduleAutoCheck();
})();

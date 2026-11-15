import { petSVG, poopSVG } from './sprites.js';

const $ = (id) => document.getElementById(id);
const views = ['auth', 'adopt', 'game'].map((n) => [n, $(`view-${n}`)]);

let pet = null;
let mode = 'login';
let pollTimer = null;
let busy = false;
let speciesCache = null;
let selectedSpecies = 'mochi';

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed.');
    err.status = res.status;
    throw err;
  }
  return data;
}

function show(name) {
  for (const [n, el] of views) el.hidden = n !== name;
  $('view-boards').hidden = name === 'auth';
  $('userbar').hidden = name === 'auth';
}

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const kid of kids) node.append(kid);
  return node;
}

let toastTimer;
function toast(msg, kind = 'info') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 3500);
}

// ---------- auth ----------
function setMode(m) {
  mode = m;
  $('tab-login').classList.toggle('active', m === 'login');
  $('tab-register').classList.toggle('active', m === 'register');
  $('auth-submit').textContent = m === 'login' ? 'Log in' : 'Create account';
  $('auth-pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('auth-error').textContent = '';
}
$('tab-login').onclick = () => setMode('login');
$('tab-register').onclick = () => setMode('register');

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('auth-error').textContent = '';
  $('auth-submit').disabled = true;
  try {
    await api(`/auth/${mode}`, {
      method: 'POST',
      body: { username: $('auth-user').value.trim(), password: $('auth-pass').value },
    });
    $('auth-pass').value = '';
    await boot();
  } catch (err) {
    $('auth-error').textContent = err.message;
  } finally {
    $('auth-submit').disabled = false;
  }
});

$('logout').onclick = async () => {
  await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  stopPolling();
  pet = null;
  show('auth');
};

// ---------- adopt ----------
async function renderAdopt(lastPet) {
  speciesCache ??= (await api('/species')).species;
  const list = $('species-list');
  list.replaceChildren();
  for (const [key, info] of Object.entries(speciesCache)) {
    const card = el('button', {
      type: 'button',
      class: `species ${key === selectedSpecies ? 'selected' : ''}`,
      onclick: () => { selectedSpecies = key; renderAdopt(lastPet); },
    });
    const preview = { species: key, stage: 'adult', form: 'normal', alive: true, mood: 'happy', hatchesInMs: 0 };
    card.append(el('div', { class: 'species-art', html: petSVG(preview) }));
    card.append(el('b', {}, `${info.name} ${info.jp}`), el('small', {}, info.trait));
    list.append(card);
  }
  const note = $('memorial-note');
  note.hidden = !lastPet;
  if (lastPet) {
    const days = lastPet.ageDays;
    note.textContent = `${lastPet.name} lived ${days} day${days === 1 ? '' : 's'} and passed away from ${lastPet.cause}. Ready to try again?`;
  }
  show('adopt');
}

$('adopt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('adopt-error').textContent = '';
  try {
    await api('/pet', { method: 'POST', body: { name: $('pet-name').value, species: selectedSpecies } });
    $('pet-name').value = '';
    await refresh();
  } catch (err) {
    $('adopt-error').textContent = err.message;
  }
});

// ---------- game ----------
const STAT_DEFS = [
  ['hunger', 'Fullness', 'おなか', '#ff9f43'],
  ['happiness', 'Happiness', 'きげん', '#ff6f9c'],
  ['energy', 'Energy', 'げんき', '#4cc9f0'],
  ['hygiene', 'Cleanliness', 'きれい', '#7bd88f'],
  ['health', 'Health', 'けんこう', '#e85d75'],
];

const STAGE_LABEL = { egg: 'Egg', baby: 'Baby', child: 'Child', teen: 'Teen', adult: 'Adult' };
const FORM_LABEL = { angel: 'Angelic', normal: 'Normal', rascal: 'Rascal' };

function formatAge(p) {
  const mins = Math.floor(p.ageMs / 60000);
  if (mins < 60) return `${mins} min old`;
  return `${p.ageDays} day${p.ageDays === 1 ? '' : 's'} old`;
}

function renderStats(p) {
  const box = $('stats');
  if (!box.children.length) {
    for (const [key, label, jp, color] of STAT_DEFS) {
      box.append(el('div', { class: 'stat', 'data-stat': key },
        el('div', { class: 'stat-label' }, el('span', {}, label), el('small', {}, jp)),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: `background:${color}` })),
        el('span', { class: 'val' }),
      ));
    }
  }
  for (const [key] of STAT_DEFS) {
    const row = box.querySelector(`[data-stat="${key}"]`);
    const v = p.stats[key];
    row.querySelector('.fill').style.width = `${v}%`;
    row.querySelector('.val').textContent = v;
    row.classList.toggle('low', v < 25);
  }
}

function renderScene(p) {
  const scene = $('scene');
  const poops = Array.from({ length: p.poop }, (_, i) => `<span class="poop-slot s${i}">${poopSVG()}</span>`).join('');
  scene.className = `scene ${p.sleeping ? 'night' : 'day'}`;
  scene.innerHTML = `<div class="ground"></div><div class="pet-wrap">${petSVG(p)}</div>${poops}`;
  const note = $('screen-note');
  if (!p.alive) note.textContent = `Rest in peace, ${p.name}`;
  else if (p.stage === 'egg') note.textContent = `Hatching in ${Math.ceil(p.hatchesInMs / 1000)}s...`;
  else if (p.sleeping) note.textContent = 'Zzz... lights are off';
  else if (p.needs.length) note.textContent = `${p.name} needs attention!`;
  else note.textContent = '';
  note.classList.toggle('alert', p.alive && p.stage !== 'egg' && !p.sleeping && p.needs.length > 0);
}

function renderBadges(p) {
  const b = $('pet-badges');
  b.replaceChildren();
  const add = (text, cls) => b.append(el('span', { class: `badge ${cls}` }, text));
  if (!p.alive) add('Passed away', 'dead');
  else {
    if (p.sleeping) add('Sleeping', 'sleep');
    if (p.sick) add('Sick', 'sick');
    if (p.needs.includes('hungry')) add('Hungry', 'warn');
    if (p.poop > 0) add(`Mess x${p.poop}`, 'warn');
    if (p.needs.includes('lonely')) add('Lonely', 'warn');
    if (!p.needs.length && !p.sleeping && p.stage !== 'egg') add('Doing great', 'ok');
  }
}

function renderActions(p) {
  const disabled = !p.alive || p.stage === 'egg';
  for (const btn of $('actions').querySelectorAll('button')) {
    const act = btn.dataset.act;
    let off = disabled || busy;
    if (!off && p.sleeping && act !== 'light') off = true;
    btn.disabled = off;
  }
  $('light-label').textContent = p.sleeping ? 'Lights on' : 'Lights off';
}

function renderPet(p) {
  pet = p;
  $('pet-title').textContent = `${p.name} · ${p.speciesInfo.name} ${p.speciesInfo.jp}`;
  const stage = STAGE_LABEL[p.stage] + (p.stage === 'adult' && p.form ? ` (${FORM_LABEL[p.form]})` : '');
  $('pet-sub').textContent = p.stage === 'egg'
    ? 'Waiting to hatch'
    : `${stage} · ${formatAge(p)} · ${p.weight}g`;
  $('device-name').textContent = p.name;
  renderStats(p);
  renderScene(p);
  renderBadges(p);
  renderActions(p);
}

async function loadSide() {
  const [ev, lb, mem] = await Promise.all([api('/events'), api('/leaderboard'), api('/memorial')]);
  const events = $('events');
  events.replaceChildren(...ev.events.map((e) =>
    el('li', {}, el('time', {}, new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), el('span', {}, e.text))));
  if (!ev.events.length) events.append(el('li', {}, 'Nothing yet.'));

  const board = $('leaderboard');
  board.replaceChildren(...lb.pets.map((p) =>
    el('li', { class: p.alive ? 'alive' : '' },
      el('span', { class: 'who' }, `${p.name} (${p.owner})`),
      el('span', { class: 'meta' }, `${p.ageDays}d ${p.alive ? '· alive' : '· ☆'}`))));
  if (!lb.pets.length) board.append(el('li', {}, 'No pets yet. Be the first!'));

  const memorial = $('memorial');
  memorial.replaceChildren(...mem.pets.map((p) =>
    el('li', {}, el('span', { class: 'who' }, p.name), el('span', { class: 'meta' }, `${p.ageDays}d · ${p.cause}`))));
  if (!mem.pets.length) memorial.append(el('li', {}, 'No one has passed away. Keep it up!'));
}

async function refresh() {
  const { pet: p } = await api('/pet');
  if (!p) { stopPolling(); await renderAdopt(null); return; }
  if (!p.alive) {
    renderPet(p);
    show('game');
    stopPolling();
    await loadSide();
    $('actions').querySelectorAll('button').forEach((b) => (b.disabled = true));
    showDeath(p);
    return;
  }
  $('adopt-after')?.remove();
  show('game');
  renderPet(p);
  startPolling();
  await loadSide();
}

function showDeath(p) {
  const wrap = $('adopt-after');
  wrap?.remove();
  const box = el('div', { id: 'adopt-after', class: 'death card' },
    el('p', {}, `${p.name} passed away from ${p.cause}. They lived ${p.ageDays} day${p.ageDays === 1 ? '' : 's'}.`),
    el('button', { class: 'primary', onclick: () => renderAdopt(p) }, 'Adopt a new egg'));
  document.querySelector('.panel-col').prepend(box);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (busy || document.hidden) return;
    try {
      const { pet: p } = await api('/pet');
      if (!p) return;
      const prev = pet;
      renderPet(p);
      if (prev?.alive && !p.alive) await refresh();
      else if (prev?.stage !== p.stage) loadSide();
    } catch (err) {
      if (err.status === 401) { stopPolling(); show('auth'); }
    }
  }, 5000);
}
function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pollTimer) api('/pet').then(({ pet: p }) => p && renderPet(p)).catch(() => {});
});

function burst(emoji) {
  const fx = $('fx');
  for (let i = 0; i < 4; i++) {
    const s = el('span', { class: 'fx-item', style: `left:${30 + Math.random() * 40}%;animation-delay:${i * 0.12}s` }, emoji);
    fx.append(s);
    setTimeout(() => s.remove(), 1600);
  }
}
const FX = { meal: '🍙', snack: '🍡', cuddle: '💗', clean: '✨', bath: '🫧', medicine: '➕', play: '⭐', light: '💤' };

async function act(action, body = {}) {
  if (busy) return;
  busy = true;
  renderActions(pet);
  try {
    const res = await api(`/pet/${action}`, { method: 'POST', body });
    renderPet(res.pet);
    const kind = action === 'feed' ? body.kind : action;
    burst(res.extra?.won === false ? '💨' : FX[kind] ?? '✨');
    toast(res.message, res.extra?.won === false ? 'warn' : 'good');
    loadSide();
    if (!res.pet.alive) await refresh();
  } catch (err) {
    if (err.status === 401) { show('auth'); stopPolling(); }
    else { toast(err.message, 'warn'); await api('/pet').then(({ pet: p }) => p && renderPet(p)).catch(() => {}); }
  } finally {
    busy = false;
    if (pet) renderActions(pet);
  }
}

$('actions').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn || btn.disabled) return;
  const { act: action, kind } = btn.dataset;
  if (action === 'play') { $('play-picker').hidden = false; return; }
  act(action, kind ? { kind } : {});
});
$('play-picker').addEventListener('click', (e) => {
  const g = e.target.closest('button[data-guess]')?.dataset.guess;
  if (!g) return;
  $('play-picker').hidden = true;
  if (g !== 'cancel') act('play', { guess: g });
});

async function boot() {
  try {
    const me = await api('/me');
    $('whoami').textContent = me.user.username;
    await refresh();
  } catch (err) {
    if (err.status === 401) { show('auth'); setMode('login'); }
    else { show('auth'); $('auth-error').textContent = err.message; }
  }
}

boot();

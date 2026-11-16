import { petSVG, poopSVG } from './sprites.js';
import { openSheet, closeSheet } from './sheet.js';
import { install, installState, onInstallChange } from './pwa.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// three.js loads on demand; without it (or without WebGL) 3D pets fall back to flat SVG art.
let three = null;
const threeReady = import('./pet3d.js')
  .then((m) => { three = m.webglSupported() ? m : null; })
  .catch(() => {});
let stage3d = null;
const is3d = (species) => !!three?.MODEL_SPECIES.has(species);
function art(p) {
  if (is3d(p.species)) {
    const url = three.portrait(p);
    if (url) return `<img class="portrait" alt="" src="${url}">`;
  }
  return petSVG(p);
}
const portraitOf = (species, extra = {}) => art({ species, stage: 'adult', form: 'normal', alive: true, mood: 'happy', hatchesInMs: 60000, ...extra });

const state = { user: null, pet: null, view: 'splash', tab: 'pet', busy: false, mode: 'register', species: null, pick: 0, hatchEndsAt: 0, lastCuddle: 0, flashMood: null, flashUntil: 0, chat: [] };
let pollTimer = null;
let hatchTimer = null;
let flashTimer = null;

const EMOTION_FALLBACK = {
  dead: { label: 'Gone', emoji: '👻' }, egg: { label: 'Waiting', emoji: '🥚' }, sleeping: { label: 'Sleepy', emoji: '💤' },
  sick: { label: 'Sick', emoji: '🤒' }, hungry: { label: 'Hungry', emoji: '🥺' }, tired: { label: 'Tired', emoji: '🥱' },
  sad: { label: 'Sad', emoji: '😢' }, lonely: { label: 'Lonely', emoji: '💭' }, grumpy: { label: 'Grumpy', emoji: '😤' },
  bored: { label: 'Bored', emoji: '😐' }, shy: { label: 'Shy', emoji: '😳' }, curious: { label: 'Curious', emoji: '🤔' },
  excited: { label: 'Excited', emoji: '🤩' }, proud: { label: 'Proud', emoji: '😌' }, love: { label: 'Loved', emoji: '💗' },
  happy: { label: 'Happy', emoji: '😊' }, okay: { label: 'Calm', emoji: '🙂' }, sleepy: { label: 'Drowsy', emoji: '😴' },
};

function displayPet(p) {
  if (!p) return p;
  if (state.flashMood && Date.now() < state.flashUntil) {
    return { ...p, mood: state.flashMood, emotion: EMOTION_FALLBACK[state.flashMood] ?? p.emotion };
  }
  return p;
}

function flashEmotion(mood, ms = 4500) {
  if (!mood) return;
  state.flashMood = mood;
  state.flashUntil = Date.now() + ms;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    state.flashMood = null;
    if (state.pet) renderPet(state.pet);
  }, ms);
}

// ---------------------------------------------------------------- utils
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...kids);
  return node;
}
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    const err = new Error("You're offline. Check your connection and try again.");
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 3200);
}

function rel(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const THEME = { light: '#ffe8f0', night: '#2c2f5c' };
function setTheme(color) { $('theme-color').setAttribute('content', color); }

function setView(name) {
  state.view = name;
  for (const n of ['splash', 'auth', 'adopt', 'main']) $(`view-${n}`).hidden = n !== name;
  if (name !== 'main') setTheme(THEME.light);
  if (name !== 'main') stopPolling();
}

// ---------------------------------------------------------------- auth
function setMode(mode) {
  state.mode = mode;
  const reg = mode === 'register';
  $('tab-register').setAttribute('aria-selected', String(reg));
  $('tab-login').setAttribute('aria-selected', String(!reg));
  $('auth-submit').textContent = reg ? 'Create account' : 'Log in';
  $('auth-tagline').textContent = reg ? 'Hatch an egg. Raise a friend.' : 'Welcome back! Your pet missed you.';
  $('auth-user-hint').hidden = !reg;
  $('auth-pass-hint').hidden = !reg;
  $('auth-pass').autocomplete = reg ? 'new-password' : 'current-password';
  setAuthError('');
}
function setAuthError(msg, field) {
  $('auth-error').textContent = msg;
  for (const id of ['auth-user', 'auth-pass']) $(id).setAttribute('aria-invalid', String(!!msg && (!field || field === id)));
  if (msg && field) $(field).focus();
}
$('tab-register').onclick = () => setMode('register');
$('tab-login').onclick = () => setMode('login');
$('pass-toggle').onclick = () => {
  const input = $('auth-pass');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('pass-toggle').textContent = show ? '🙈' : '👁️';
  $('pass-toggle').setAttribute('aria-pressed', String(show));
  $('pass-toggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
};

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('auth-user').value.trim();
  const password = $('auth-pass').value;
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setAuthError('Username must be 3-20 letters, numbers or underscores.', 'auth-user');
  if (password.length < 6) return setAuthError('Password must be at least 6 characters.', 'auth-pass');
  setAuthError('');
  const btn = $('auth-submit');
  const label = btn.textContent;
  btn.disabled = true;
  btn.replaceChildren(el('span', { class: 'spinner' }), state.mode === 'register' ? 'Creating…' : 'Logging in…');
  try {
    await api(`/auth/${state.mode}`, { method: 'POST', body: { username, password } });
    localStorage.setItem('tama_seen', '1');
    $('auth-pass').value = '';
    state.user = { username };
    await enterGame();
  } catch (err) {
    setAuthError(err.message, err.status === 401 ? 'auth-pass' : err.status === 409 ? 'auth-user' : undefined);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

async function logout() {
  await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  state.user = null;
  state.pet = null;
  stopPolling();
  setMode('login');
  setView('auth');
}

// ---------------------------------------------------------------- adopt
const NAMES = ['Momo', 'Kiki', 'Mochi', 'Bao', 'Suki', 'Nori', 'Pochi', 'Hana', 'Yuki', 'Maru', 'Tama', 'Sora', 'Ume', 'Riko', 'Chibi', 'Kuro'];
let slideObserverRaf = 0;

function pickSlide(i, scroll) {
  const slides = [...$('carousel').children];
  if (!slides.length) return;
  state.pick = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, idx) => {
    s.classList.toggle('on', idx === state.pick);
    s.setAttribute('aria-selected', String(idx === state.pick));
  });
  [...$('dots').children].forEach((d, idx) => d.classList.toggle('on', idx === state.pick));
  const key = slides[state.pick].dataset.key;
  $('adopt-submit').textContent = `Adopt ${state.species[key].name}`;
  if (scroll) slides[state.pick].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
}

async function renderAdopt(lastPet) {
  await threeReady;
  state.species ??= (await api('/species')).species;
  const keys = Object.keys(state.species).sort((a, b) => Number(!!state.species[b].model3d) - Number(!!state.species[a].model3d));
  const car = $('carousel');
  car.replaceChildren(...keys.map((key) => {
    const info = state.species[key];
    const slide = el('div', { class: 'slide', role: 'option', 'data-key': key },
      el('div', { class: 'slide-art', html: portraitOf(key) }),
      el('h2', {}, `${info.name} `, el('span', { class: 'jp' }, info.jp)),
      el('p', {}, info.trait));
    if (info.model3d) slide.append(el('span', { class: 'tag3d' }, '3D'));
    slide.addEventListener('click', () => pickSlide([...car.children].indexOf(slide), true));
    return slide;
  }));
  $('dots').replaceChildren(...keys.map(() => el('i')));
  const note = $('memorial-note');
  note.hidden = !lastPet;
  if (lastPet) note.textContent = `${lastPet.name} lived ${lastPet.ageDays} day${lastPet.ageDays === 1 ? '' : 's'} and will always be remembered. Ready for a new friend?`;
  $('adopt-sub').hidden = !!lastPet;
  $('adopt-error').textContent = '';
  setView('adopt');
  state.pick = 0;
  pickSlide(0, false);
  car.scrollLeft = 0;
}

$('carousel').addEventListener('scroll', () => {
  cancelAnimationFrame(slideObserverRaf);
  slideObserverRaf = requestAnimationFrame(() => {
    const car = $('carousel');
    const mid = car.scrollLeft + car.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    [...car.children].forEach((s, i) => {
      const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best !== state.pick) pickSlide(best, false);
  });
}, { passive: true });
$('carousel').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); pickSlide(state.pick + 1, true); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); pickSlide(state.pick - 1, true); }
});
$('car-prev').onclick = () => pickSlide(state.pick - 1, true);
$('car-next').onclick = () => pickSlide(state.pick + 1, true);
$('dice').onclick = () => { $('pet-name').value = NAMES[Math.floor(Math.random() * NAMES.length)]; $('adopt-error').textContent = ''; };

$('adopt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('pet-name').value.trim();
  const species = $('carousel').children[state.pick]?.dataset.key;
  if (!name) { $('adopt-error').textContent = 'Give your pet a name first. Tap the dice if you need ideas!'; $('pet-name').focus(); return; }
  const btn = $('adopt-submit');
  const label = btn.textContent;
  btn.disabled = true;
  btn.replaceChildren(el('span', { class: 'spinner' }), 'Hatching…');
  try {
    await api('/pet', { method: 'POST', body: { name, species } });
    $('pet-name').value = '';
    buzz(30);
    await enterGame({ firstRun: true });
  } catch (err) {
    $('adopt-error').textContent = err.message;
    btn.textContent = label;
  } finally {
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------- stats + thoughts
const STATS = [
  ['hunger', '🍙', 'Full', 'Fullness'],
  ['happiness', '😊', 'Joy', 'Happiness'],
  ['energy', '⚡', 'Energy', 'Energy'],
  ['hygiene', '✨', 'Clean', 'Cleanliness'],
  ['health', '❤️', 'Health', 'Health'],
];
const barColor = (v) => (v >= 50 ? '#4fc474' : v >= 25 ? '#ffb347' : '#ff5c7a');

function renderStats(p) {
  const box = $('stats');
  if (!box.children.length) {
    for (const [key, ico, label] of STATS) {
      box.append(el('div', { class: 'stat', 'data-stat': key, role: 'img' },
        el('span', { class: 's-ico', 'aria-hidden': 'true' }, ico),
        el('div', { class: 's-bar' }, el('i')),
        el('span', { class: 's-label' }, label)));
    }
  }
  for (const [key, , , full] of STATS) {
    const v = p.stats[key];
    const node = box.querySelector(`[data-stat="${key}"]`);
    const bar = node.querySelector('i');
    bar.style.width = `${Math.max(4, v)}%`;
    bar.style.backgroundColor = barColor(v);
    node.classList.toggle('low', v < 25 && p.alive && p.stage !== 'egg');
    node.setAttribute('aria-label', `${full} ${v} percent`);
  }
}

// What the pet is "saying", and which quick action tapping it performs.
function thought(p) {
  if (!p.alive) return null;
  if (p.stage === 'egg') return { text: 'Something is moving inside…' };
  if (p.sleeping) return { text: 'Zzz… 💤' };
  if (p.sick) return { text: "I don't feel well… 💊", act: 'medicine' };
  if (p.needs.includes('hungry')) return { text: "I'm so hungry! 🍙", act: 'feed' };
  if (p.poop > 0) return { text: 'It’s messy in here! 🧹', act: 'wash' };
  if (p.needs.includes('lonely')) return { text: 'Talk to me? 💬', act: 'chat' };
  if (p.needs.includes('tired')) return { text: "So sleepy… 💡", act: 'light' };
  if (p.mood === 'bored') return { text: 'I’m a little bored… chat?', act: 'chat' };
  if (p.mood === 'excited') return { text: 'I’m so excited!! 🤩', act: 'chat' };
  if (p.mood === 'shy') return { text: 'H-hi… 😳', act: 'chat' };
  if (p.mood === 'grumpy') return { text: 'Hmph. Clean this up!', act: 'wash' };
  const byMood = {
    love: ['I love you! 💗', 'Stay close…', 'You’re my favourite.'],
    happy: ['Today is a good day!', 'Hehe, hi there!', 'Can I have a hug?'],
    proud: ['Did you see that? I’m amazing!', 'Tell me I’m clever again.'],
    curious: ['What are you thinking?', 'Tell me a secret?'],
    okay: ['Hello! 👋', 'What shall we do?', 'La la la…', 'I’m doing okay.'],
  };
  const list = byMood[p.mood] ?? byMood.okay;
  return { text: list[Math.floor(Date.now() / 60000) % list.length], act: 'chat' };
}

function reason(action, p) {
  if (!p.alive) return `${p.name} has passed away.`;
  if (p.stage === 'egg') return "Your egg hasn't hatched yet. Almost there!";
  if (p.sleeping && action !== 'light') return `${p.name} is sleeping. Tap Wake to turn the lights on.`;
  if (action === 'medicine' && !p.sick) return `${p.name} isn't sick. Great job!`;
  if (action === 'play' && p.sick) return `${p.name} is too sick to play. Give some medicine first.`;
  if (action === 'play' && p.stats.energy < 15) return `${p.name} is too tired to play. Time for bed!`;
  return null;
}

const STAGE_LABEL = { egg: 'Egg', baby: 'Baby', child: 'Child', teen: 'Teen', adult: 'Adult' };
const FORM_LABEL = { angel: 'Angelic', normal: '', rascal: 'Rascal' };
function ageText(p) {
  const mins = Math.floor(p.ageMs / 60000);
  return mins < 60 ? `${mins} min old` : `${p.ageDays} day${p.ageDays === 1 ? '' : 's'} old`;
}

// ---------------------------------------------------------------- pet rendering
let sceneKey = '';
function renderScene(p) {
  const scene = $('scene');
  scene.className = `scene ${p.sleeping ? 'night' : 'day'}`;
  $('stage-card').classList.toggle('night', !!p.sleeping);
  const wrap = $('pet-wrap');
  const use3d = is3d(p.species);
  wrap.classList.toggle('pet3d-wrap', use3d);
  if (use3d) {
    stage3d ??= new three.PetStage({ live: true });
    stage3d.setPet(p);
    if (!wrap.contains(stage3d.canvas)) { wrap.replaceChildren(); stage3d.mount(wrap); }
    sceneKey = '3d:' + p.mood;
  } else {
    const key = [p.species, p.stage, p.form, p.mood, p.alive].join('|');
    if (key !== sceneKey || wrap.querySelector('.pet3d-canvas')) {
      wrap.innerHTML = petSVG(p);
      sceneKey = key;
    }
  }
  $('poops').innerHTML = Array.from({ length: p.poop }, () => `<span class="poop-slot">${poopSVG()}</span>`).join('');
  $('stage-hint').textContent = !p.alive || p.stage === 'egg' ? '' : p.sleeping ? 'Sleeping…' : 'Tap to cuddle · Talk below';
  setTheme(p.sleeping ? THEME.night : THEME.light);
}

function renderMood(p) {
  const chip = $('mood-chip');
  if (!p?.alive || p.stage === 'egg') { chip.hidden = true; return; }
  const info = p.emotion ?? EMOTION_FALLBACK[p.mood] ?? EMOTION_FALLBACK.okay;
  chip.hidden = false;
  chip.replaceChildren(
    el('span', { class: 'm-emoji', 'aria-hidden': 'true' }, info.emoji),
    el('span', {}, info.label));
  chip.setAttribute('aria-label', `Feeling ${info.label}`);
}

function renderBubble(p) {
  const b = $('bubble');
  const t = thought(p);
  b.hidden = !t;
  if (!t) return;
  b.textContent = t.text;
  b.classList.toggle('action', !!t.act);
  b.dataset.act = t.act ?? '';
  b.disabled = !t.act;
  b.setAttribute('aria-label', t.act ? `${t.text} Tap to help.` : t.text);
}

function renderDock(p) {
  const dock = $('dock');
  const attn = new Set();
  if (p.sick) attn.add('medicine');
  if (p.needs.includes('hungry')) attn.add('feed');
  if (p.poop > 0) attn.add('wash');
  if (p.needs.includes('lonely')) attn.add('play');
  if (p.needs.includes('tired')) attn.add('light');
  dock.hidden = !p.alive;
  $('talk-btn').hidden = !p.alive;
  if (p.alive) {
    const label = p.stage === 'egg' ? 'Whisper to the egg' : `Talk with ${p.name}`;
    $('talk-btn').querySelector('.talk-text b').textContent = label;
  }
  $('dead-cta').hidden = p.alive;
  for (const btn of dock.querySelectorAll('button')) {
    const act = btn.dataset.act;
    btn.setAttribute('aria-disabled', String(!!reason(act, p)));
    btn.classList.toggle('attn', attn.has(act) && (!p.sleeping || act === 'light') && !reason(act, p));
  }
  $('light-ico').textContent = p.sleeping ? '☀️' : '💡';
  $('light-label').textContent = p.sleeping ? 'Wake' : 'Sleep';
  if (!p.alive) {
    $('dead-text').textContent = `${p.name} passed away from ${p.cause}. They lived ${p.ageDays} day${p.ageDays === 1 ? '' : 's'}. Thank you for caring for them.`;
  }
}

function renderHatch(p) {
  const box = $('hatch');
  clearInterval(hatchTimer);
  box.hidden = p.stage !== 'egg';
  if (p.stage !== 'egg') return;
  state.hatchEndsAt = Date.now() + p.hatchesInMs;
  const tickHatch = () => {
    const left = Math.max(0, state.hatchEndsAt - Date.now());
    $('hatch-fill').style.width = `${Math.min(100, (1 - left / 60000) * 100)}%`;
    $('hatch-text').textContent = left > 0 ? `Hatching in ${Math.ceil(left / 1000)}s` : 'Hatching…';
  };
  tickHatch();
  hatchTimer = setInterval(tickHatch, 1000);
}

function renderPet(p) {
  const prev = state.pet;
  state.pet = p;
  const view = displayPet(p);
  $('ab-name').textContent = p.name;
  const form = p.stage === 'adult' && p.form ? FORM_LABEL[p.form] : '';
  $('ab-sub').textContent = p.stage === 'egg' ? `${p.speciesInfo.name} egg` : `${p.speciesInfo.jp} ${[form, STAGE_LABEL[p.stage]].filter(Boolean).join(' ')} · ${ageText(p)}`;
  renderScene(view);
  renderMood(view);
  renderStats(p);
  renderBubble(view);
  renderDock(p);
  renderHatch(p);
  if (prev?.alive && !p.alive) { buzz([60, 40, 60]); toast(`${p.name} has passed away…`, 'warn'); stopPolling(); }
  if (prev && prev.stage === 'egg' && p.stage !== 'egg') { buzz(40); toast(`${p.name} hatched! Say hello 💗`, 'good'); }
  if (prev && !prev.sick && p.sick) toast(`${p.name} is sick. Give some medicine.`, 'warn');
}

// ---------------------------------------------------------------- actions
function burst(emoji) {
  if (reduceMotion) return;
  const fx = $('fx');
  for (let i = 0; i < 4; i++) {
    const s = el('span', { class: 'fx-item', style: `left:${25 + Math.random() * 50}%;animation-delay:${i * 0.12}s` }, emoji);
    fx.append(s);
    setTimeout(() => s.remove(), 1700);
  }
}
const FX = { meal: '🍙', snack: '🍡', cuddle: '💗', clean: '✨', bath: '🫧', medicine: '➕', play: '⭐', light: '💤' };
const REACT = { feed: 'eat', cuddle: 'love', play: 'play', clean: 'clean', bath: 'clean', medicine: 'heal' };

async function act(action, body = {}, { quiet = false } = {}) {
  if (state.busy || !state.pet) return;
  state.busy = true;
  $('dock').classList.add('busy');
  try {
    const res = await api(`/pet/${action}`, { method: 'POST', body });
    renderPet(res.pet);
    const lost = res.extra?.won === false;
    if (stage3d && is3d(res.pet.species)) stage3d.react(lost ? 'sad' : REACT[action] ?? 'love');
    else burst(lost ? '💨' : FX[action === 'feed' ? body.kind : action] ?? '✨');
    buzz(action === 'cuddle' ? 8 : 16);
    if (!quiet) toast(res.message, lost ? 'warn' : 'good');
    if (state.tab === 'diary') loadDiary();
  } catch (err) {
    if (err.status === 401) { setMode('login'); setView('auth'); toast('Please log in again.'); }
    else {
      if (!quiet) toast(err.message, 'warn');
      if (err.status !== 0) await refresh({ quiet: true });
    }
  } finally {
    state.busy = false;
    $('dock').classList.remove('busy');
  }
}

function choice({ icon, title, sub, badge, disabled, onClick }) {
  const b = el('button', { class: 'choice', type: 'button', 'aria-disabled': String(!!disabled) },
    el('span', { class: 'c-ico', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'c-text' }, el('b', {}, title), el('small', {}, sub)));
  if (badge) b.append(el('span', { class: 'badge' }, badge));
  b.addEventListener('click', () => {
    if (disabled) { toast(sub, 'warn'); buzz(10); return; }
    closeSheet();
    onClick();
  });
  return b;
}

function openFeed(p) {
  const heavy = p.weight >= 30;
  const box = el('div', { class: 'choice-grid' },
    choice({ icon: '🍙', title: 'Meal', sub: p.stats.hunger >= 90 ? `${p.name} isn't hungry right now.` : `Fills the tummy · ${p.stats.hunger}% full`, badge: '+35', disabled: p.stats.hunger >= 90, onClick: () => act('feed', { kind: 'meal' }) }),
    choice({ icon: '🍡', title: 'Sweet snack', sub: heavy ? `${p.name} is too heavy for snacks. Try playing!` : 'A happy treat, but it adds weight', badge: '+15 😊', disabled: heavy, onClick: () => act('feed', { kind: 'snack' }) }));
  box.append(el('div', { class: 'weight' }, `Weight ${p.weight}g of 30g`, el('div', { class: 's-bar' }, el('i', { style: `width:${Math.min(100, (p.weight / 30) * 100)}%` }))));
  openSheet({ title: 'What shall we eat?', jp: 'ごはん', content: box });
}

function openPlay(p) {
  const box = el('div', {},
    el('p', { class: 'sheet-note' }, `Guess which way ${p.name} will look. Win for a big happiness boost!`),
    el('div', { class: 'guess' },
      el('button', { type: 'button', 'data-autofocus': '', onclick: () => { closeSheet(); act('play', { guess: 'left' }); } }, el('span', {}, '←'), 'Left'),
      el('button', { type: 'button', onclick: () => { closeSheet(); act('play', { guess: 'right' }); } }, el('span', {}, '→'), 'Right')));
  openSheet({ title: 'Let’s play!', jp: 'あそぶ', content: box });
}

function openWash(p) {
  const box = el('div', { class: 'choice-grid' },
    choice({ icon: '🧹', title: 'Clean up', sub: p.poop ? `${p.poop} mess${p.poop > 1 ? 'es' : ''} to clean` : 'Nothing to clean up.', disabled: !p.poop, onClick: () => act('clean') }),
    choice({ icon: '🛁', title: 'Bath', sub: p.stats.hygiene >= 95 ? `${p.name} is already squeaky clean.` : `Cleanliness ${p.stats.hygiene}%`, disabled: p.stats.hygiene >= 95, onClick: () => act('bath') }));
  openSheet({ title: 'Wash & clean', jp: 'おふろ', content: box });
}

function openWelcome() {
  const box = el('div', {},
    el('ul', { class: 'tip-list' },
      el('li', {}, el('b', {}, 'Tap your pet'), ' to cuddle it.'),
      el('li', {}, el('b', {}, 'Talk with your pet.'), ' Say hello, tell a joke, or say you love them — they answer in their own voice.'),
      el('li', {}, el('b', {}, 'Keep the bars green.'), ' They drop over time, even while you are away.'),
      el('li', {}, el('b', {}, 'Watch the speech bubble.'), ' Your pet tells you what it needs. Tap it to help.'),
      el('li', {}, el('b', {}, 'Lights off'), ' when it is sleepy so it can recharge.')),
    el('button', { class: 'btn-primary block', type: 'button', 'data-autofocus': '', onclick: closeSheet }, 'Let’s go!'));
  openSheet({ title: 'Caring for your pet', jp: 'お世話', content: box });
}

const QUICK_CHATS = [
  'I love you!',
  'How are you?',
  'Want to play?',
  'You are so cute',
  'Tell me a joke',
  'Good night',
];

function openChat(p) {
  const log = el('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const quick = el('div', { class: 'chat-quick' });
  for (const q of QUICK_CHATS) {
    quick.append(el('button', { type: 'button', onclick: () => sendChat(q) }, q));
  }
  const input = el('input', {
    type: 'text', maxlength: '140', placeholder: `Say something to ${p.name}…`,
    enterkeyhint: 'send', autocomplete: 'off', autocorrect: 'on', 'data-autofocus': '',
    'aria-label': `Message to ${p.name}`,
  });
  const sendBtn = el('button', { class: 'send', type: 'button', 'aria-label': 'Send' }, '➤');
  const compose = el('div', { class: 'chat-compose' }, input, sendBtn);
  const box = el('div', { class: 'chat-sheet' }, log, quick, compose);

  function paintHistory() {
    log.replaceChildren();
    if (!state.chat.length) {
      log.append(el('div', { class: 'chat-row pet' },
        el('div', { class: 'chat-bubble' }, p.stage === 'egg'
          ? 'The egg is quiet… but listening.'
          : p.sleeping
            ? `${p.name} is dreaming. Soft words still reach them.`
            : `Hi! I’m ${p.name}. Talk to me — I get lonely sometimes.`),
        el('span', { class: 'chat-meta' }, 'just now')));
    }
    for (const m of state.chat.slice(-12)) {
      log.append(
        el('div', { class: `chat-row ${m.who}` },
          el('div', { class: 'chat-bubble' }, m.text),
          el('span', { class: 'chat-meta' }, m.who === 'pet' && m.emotion ? `${EMOTION_FALLBACK[m.emotion]?.emoji ?? ''} ${m.emotion}` : '')));
    }
    log.scrollTop = log.scrollHeight;
  }

  async function sendChat(text) {
    const clean = String(text ?? input.value).trim();
    if (!clean || state.busy) return;
    input.value = '';
    state.chat.push({ who: 'you', text: clean });
    paintHistory();
    const typing = el('div', { class: 'chat-row pet typing' }, el('div', { class: 'chat-bubble' }, `${p.name} is thinking…`));
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    state.busy = true;
    sendBtn.disabled = true;
    try {
      const res = await api('/pet/chat', { method: 'POST', body: { text: clean } });
      typing.remove();
      state.pet = res.pet;
      const emotion = res.extra?.emotion;
      state.chat.push({ who: 'pet', text: res.extra?.reply ?? res.message, emotion });
      paintHistory();
      flashEmotion(emotion);
      renderPet(res.pet);
      const react = emotion === 'sad' ? 'sad' : emotion === 'shy' ? 'shy' : emotion === 'proud' ? 'proud' : emotion === 'excited' ? 'excited' : emotion === 'love' ? 'love' : 'chat';
      if (stage3d && is3d(res.pet.species)) stage3d.react(react);
      else burst(EMOTION_FALLBACK[emotion]?.emoji ?? '💬');
      buzz(14);
      if (state.tab === 'diary') loadDiary();
    } catch (err) {
      typing.remove();
      toast(err.message, 'warn');
      if (err.status === 401) { closeSheet(); setMode('login'); setView('auth'); }
    } finally {
      state.busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', () => sendChat());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });
  paintHistory();
  openSheet({ title: `Chat with ${p.name}`, jp: 'おはなし', content: box });
}

$('dock').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  const p = state.pet;
  if (!btn || !p) return;
  const action = btn.dataset.act;
  const why = reason(action, p);
  if (why) { toast(why, 'warn'); buzz(10); $('stage-card').classList.remove('nudge'); void $('stage-card').offsetWidth; $('stage-card').classList.add('nudge'); return; }
  if (action === 'feed') openFeed(p);
  else if (action === 'play') openPlay(p);
  else if (action === 'wash') openWash(p);
  else act(action);
});

$('bubble').addEventListener('click', () => {
  const p = state.pet;
  const a = $('bubble').dataset.act;
  if (!p || !a) return;
  if (a === 'feed') act('feed', { kind: 'meal' });
  else if (a === 'wash') act('clean');
  else if (a === 'play') openPlay(p);
  else if (a === 'chat') openChat(p);
  else act(a);
});

$('talk-btn').addEventListener('click', () => {
  if (state.pet) openChat(state.pet);
});

$('stage-card').addEventListener('pointerdown', (e) => {
  const p = state.pet;
  if (!p || e.target.closest('.bubble')) return;
  const now = Date.now();
  if (now - state.lastCuddle < 900) return;
  state.lastCuddle = now;
  if (!p.alive) return;
  if (p.stage === 'egg') { buzz(10); burst('🍀'); return; }
  if (p.sleeping) { toast(`Shh, ${p.name} is sleeping.`); return; }
  act('cuddle', {}, { quiet: true });
});
$('dead-adopt').onclick = () => renderAdopt(state.pet);

// ---------------------------------------------------------------- tabs + side panels
const LOADERS = { diary: () => loadDiary(), ranks: () => loadRanks(), me: () => loadMe() };
function switchTab(tab) {
  state.tab = tab;
  for (const b of document.querySelectorAll('.tabbar button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const name of ['pet', 'diary', 'ranks', 'me']) $(`panel-${name}`).hidden = name !== tab;
  LOADERS[tab]?.();
  if (tab === 'pet' && stage3d) requestAnimationFrame(() => stage3d.fit());
}
$('view-main').querySelector('.tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) { buzz(6); switchTab(b.dataset.tab); }
});

async function loadDiary() {
  try {
    const { events } = await api('/events');
    const list = $('events');
    list.replaceChildren(...events.map((ev) => el('li', {}, el('span', {}, ev.text), el('time', {}, rel(ev.at)))));
    if (!events.length) list.replaceChildren(el('li', { class: 'empty' }, 'Nothing yet. Say hello to your pet!'));
  } catch (err) { toast(err.message, 'warn'); }
}

function rankRow(p, i, mine) {
  const art2 = el('span', { class: 'r-art', html: portraitOf(p.species, { stage: p.stage === 'egg' ? 'child' : p.stage, form: p.form, mood: p.alive ? 'happy' : 'sad' }) });
  return el('li', { class: mine ? 'mine' : '' }, art2,
    el('span', { class: 'r-text' }, el('b', {}, p.name), el('small', {}, `by ${p.owner}`)),
    el('span', { class: `r-meta ${p.alive ? '' : 'dead'}` }, `${p.ageDays}d ${p.alive ? 'alive' : '☆'}`));
}

async function loadRanks() {
  try {
    const [lb, mem] = await Promise.all([api('/leaderboard'), api('/memorial')]);
    const board = $('leaderboard');
    board.replaceChildren(...lb.pets.map((p, i) => rankRow(p, i, p.owner === state.user?.username)));
    if (!lb.pets.length) board.replaceChildren(el('li', { class: 'empty' }, 'No pets yet. Be the first!'));
    const memorial = $('memorial');
    memorial.replaceChildren(...mem.pets.map((p) => el('li', {}, el('span', { class: 'r-art', html: portraitOf(p.species, { stage: p.stage, form: p.form, alive: false, mood: 'dead' }) }),
      el('span', { class: 'r-text' }, el('b', {}, p.name), el('small', {}, `Passed away from ${p.cause}`)),
      el('span', { class: 'r-meta dead' }, `${p.ageDays}d`))));
    if (!mem.pets.length) memorial.replaceChildren(el('li', { class: 'empty' }, 'Nobody has passed away. Keep it up!'));
  } catch (err) { toast(err.message, 'warn'); }
}

async function loadMe() {
  $('me-name').textContent = state.user?.username ?? '';
  const p = state.pet;
  $('me-avatar').innerHTML = p ? portraitOf(p.species, { stage: p.stage === 'egg' ? 'child' : p.stage, form: p.form, alive: p.alive, mood: p.alive ? 'happy' : 'dead' }) : '';
  $('me-sub').textContent = p ? `Looking after ${p.name}` : 'No pet yet';
  updateInstallUI();
}
$('me-logout').onclick = logout;
$('me-tips').onclick = openWelcome;
$('me-install').onclick = () => { if (installState() !== 'installed') install(); };

// ---------------------------------------------------------------- install UI
const DISMISS_KEY = 'tama_install_dismissed';
function installDismissed() {
  const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() - t < 7 * 86400_000;
}
function updateInstallUI() {
  const s = installState();
  const canOffer = s === 'prompt' || s === 'ios';
  const p = state.pet;
  const tall = matchMedia('(min-height: 760px)').matches;
  const showBanner = canOffer && tall && !installDismissed() && state.view === 'main' && !!p?.alive && p.stage !== 'egg';
  $('install-banner').hidden = !showBanner;
  $('ab-install').hidden = !(canOffer && !showBanner && state.view === 'main');
  const sub = $('me-install-sub');
  const row = $('me-install');
  row.disabled = s === 'installed';
  sub.textContent = s === 'installed' ? 'Installed. Enjoy!' : s === 'ios' ? 'Add to Home Screen from Safari’s Share menu' : s === 'prompt' ? 'Add Tamagotchi to your home screen' : 'Use your browser menu to install';
}
$('banner-install').onclick = () => install();
$('ab-install').onclick = () => install();
$('banner-close').onclick = () => { localStorage.setItem(DISMISS_KEY, String(Date.now())); updateInstallUI(); };
onInstallChange(updateInstallUI);
addEventListener('resize', updateInstallUI);

// ---------------------------------------------------------------- loop
async function refresh({ quiet = false } = {}) {
  try {
    const { pet } = await api('/pet');
    if (!pet) { await renderAdopt(null); return; }
    if (state.view !== 'main') await showMain();
    renderPet(pet);
  } catch (err) {
    if (err.status === 401) { setMode('login'); setView('auth'); }
    else if (!quiet) toast(err.message, 'warn');
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { if (!document.hidden && !state.busy) refresh({ quiet: true }); }, 5000);
}
function stopPolling() { clearInterval(pollTimer); pollTimer = null; clearInterval(hatchTimer); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.view === 'main') refresh({ quiet: true }); });

function setOnline() { $('offline-banner').hidden = navigator.onLine; }
addEventListener('online', () => { setOnline(); if (state.view === 'main') refresh({ quiet: true }); });
addEventListener('offline', setOnline);

async function showMain() {
  await threeReady;
  setView('main');
  switchTab('pet');
}

async function enterGame({ firstRun = false } = {}) {
  await threeReady;
  const { pet } = await api('/pet');
  if (!pet) return renderAdopt(null);
  await showMain();
  renderPet(pet);
  updateInstallUI();
  if (pet.alive) startPolling();
  if (firstRun || !localStorage.getItem('tama_welcomed')) {
    localStorage.setItem('tama_welcomed', '1');
    setTimeout(openWelcome, 400);
  }
}

function bootError(msg) {
  const splash = $('view-splash');
  splash.replaceChildren(
    el('p', {}, msg),
    el('button', { class: 'btn-primary', type: 'button', onclick: () => location.reload() }, 'Try again'));
  setView('splash');
}

async function boot() {
  setOnline();
  setMode(localStorage.getItem('tama_seen') ? 'login' : 'register');
  try {
    const me = await api('/me');
    state.user = me.user;
    await enterGame();
  } catch (err) {
    if (err.status === 401) setView('auth');
    else bootError(err.status === 0 || err.status === 503 ? "Can't reach your pet. Check your connection." : err.message);
  }
}

boot();

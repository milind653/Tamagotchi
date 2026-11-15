import { petSVG } from './sprites.js';
import { install, installState, onInstallChange } from './pwa.js';

const $ = (id) => document.getElementById(id);

// 3D pets need three.js + WebGL; without them they fall back to flat SVG art.
const three = await import('./pet3d.js').then((m) => (m.webglSupported() ? m : null)).catch(() => null);
const is3d = (species) => !!three?.MODEL_SPECIES.has(species);
const make = (species, extra = {}) => {
  const pet = { species, stage: 'adult', form: 'normal', alive: true, mood: 'happy', hatchesInMs: 60000, ...extra };
  if (is3d(species)) {
    const url = three.portrait(pet);
    if (url) return `<img class="portrait" alt="" src="${url}">`;
  }
  return petSVG(pet);
};

// Falling petals and drifting clouds
const sky = $('sky');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${10 + Math.random() * 12}s`;
    p.style.animationDelay = `${-Math.random() * 20}s`;
    p.style.transform = `scale(${0.6 + Math.random()})`;
    sky.append(p);
  }
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('span');
    c.className = 'cloud';
    c.style.top = `${8 + i * 20}%`;
    c.style.animationDuration = `${70 + i * 25}s`;
    c.style.animationDelay = `${-i * 30}s`;
    c.style.opacity = String(0.5 + Math.random() * 0.4);
    sky.append(c);
  }
}

// Interactive hero demo (local only, nothing is saved)
const demo = { species: 'panda', sleeping: false };
let stage = null;
function drawDemo() {
  const mood = demo.sleeping ? 'sleeping' : 'happy';
  const pet = { species: demo.species, stage: 'adult', form: 'normal', alive: true, mood, hatchesInMs: 60000 };
  const box = $('demo-pet');
  $('demo-scene').className = `scene ${demo.sleeping ? 'night' : 'day'}`;
  if (is3d(demo.species)) {
    box.classList.add('pet3d-wrap');
    if (!stage) {
      stage = new three.PetStage({ live: true });
      box.replaceChildren();
      stage.mount(box);
    }
    stage.setPet(pet);
  } else {
    box.classList.remove('pet3d-wrap');
    stage?.canvas.remove();
    stage?.stop();
    stage = null;
    box.innerHTML = petSVG({ ...pet, stage: 'adult' });
  }
}
function demoFx(emoji) {
  const fx = $('demo-fx');
  for (let i = 0; i < 4; i++) {
    const s = document.createElement('span');
    s.className = 'fx-item';
    s.textContent = emoji;
    s.style.left = `${30 + Math.random() * 40}%`;
    s.style.animationDelay = `${i * 0.12}s`;
    fx.append(s);
    setTimeout(() => s.remove(), 1600);
  }
}
const NAMES = { panda: 'Panda', kitsune: 'Kitsune', penguin: 'Pen', hamster: 'Hamu', axolotl: 'Uparupa', mochi: 'Mochi', neko: 'Neko', usagi: 'Usagi', tori: 'Tori' };
const REACTIONS = {
  meal: ['🍙', 'Yum! Oishii!', 'eat'],
  play: ['⭐', 'Wheee! So fun!', 'play'],
  cuddle: ['💗', 'Hehe, that tickles!', 'love'],
};
document.querySelector('.demo-buttons').addEventListener('click', (e) => {
  const key = e.target.closest('button[data-demo]')?.dataset.demo;
  if (!key) return;
  if (key === 'sleep') {
    demo.sleeping = !demo.sleeping;
    $('demo-note').textContent = demo.sleeping ? 'Zzz... oyasumi' : 'Good morning!';
    if (!stage && demo.sleeping) demoFx('💤');
    drawDemo();
    return;
  }
  if (demo.sleeping) {
    $('demo-note').textContent = `Shh, ${NAMES[demo.species]} is sleeping. Turn the lights on!`;
    return;
  }
  const [emoji, note, kind] = REACTIONS[key];
  if (stage) stage.react(kind); else demoFx(emoji);
  $('demo-note').textContent = note;
});
$('demo-pet').addEventListener('pointerdown', () => { $('demo-note').textContent = 'Hi there! Pet me again!'; if (!stage) demoFx('💗'); });

const picker = $('demo-picker');
for (const key of Object.keys(NAMES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = NAMES[key];
  b.setAttribute('aria-label', `Meet ${NAMES[key]}`);
  b.className = key === demo.species ? 'chip on' : 'chip';
  b.innerHTML = make(key);
  b.addEventListener('click', () => {
    demo.species = key;
    demo.sleeping = false;
    picker.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    document.querySelector('.device-name').textContent = NAMES[key];
    $('demo-note').textContent = `Hi, I'm ${NAMES[key]}!`;
    drawDemo();
  });
  picker.append(b);
}
drawDemo();

// Species cards
const SPECIES = [
  ['panda', 'Panda', 'パンダ', 'A cuddly cub with the fluffiest ears. Loves hugs more than bamboo.', '#d8d2e4', true],
  ['kitsune', 'Kitsune', 'きつね', 'A fluffy fox kit with a big swishy tail and a heart of gold.', '#ffcf99', true],
  ['penguin', 'Pen', 'ペンギン', 'A waddling chick with tiny flippers and the biggest eyes.', '#c6d8ff', true],
  ['hamster', 'Hamu', 'ハムスター', 'A chubby hamster who never lets go of their favourite seed.', '#ffe0b8', true],
  ['axolotl', 'Uparupa', 'ウーパー', 'A forever-smiling axolotl with fluffy little gills.', '#ffc4d8', true],
  ['mochi', 'Mochi', 'もち', 'A squishy rice-cake blob with a little leaf on its head.', '#ffc9d9'],
  ['neko', 'Neko', 'ねこ', 'A sleepy little kitten with whiskers and pointy ears.', '#ffcf99'],
  ['usagi', 'Usagi', 'うさぎ', 'A bouncy bunny with long, floppy ears.', '#d9ccff'],
  ['tori', 'Tori', 'とり', 'A chirpy round chick with a tiny beak.', '#ffe27a'],
];
$('species-row').replaceChildren(...SPECIES.map(([key, name, jp, text, color, new3d]) => {
  const card = document.createElement('div');
  card.className = 'sp-card reveal';
  card.style.setProperty('--c', color);
  card.innerHTML = `${new3d ? '<span class="new-badge">NEW · 3D</span>' : ''}<div class="sp-art">${make(key)}</div><h3>${name} <span>${jp}</span></h3><p>${text}</p>`;
  return card;
}));

// Growth timeline
const STAGES = [
  ['egg', 'Egg', 'First minute', {}],
  ['baby', 'Baby', 'Under 1 day', { mood: 'okay' }],
  ['child', 'Child', '1 to 3 days', {}],
  ['teen', 'Teen', '3 to 7 days', {}],
  ['adult', 'Adult', '7 days and up', { form: 'angel' }],
];
$('timeline').replaceChildren(...STAGES.map(([stage, label, age, extra]) => {
  const li = document.createElement('li');
  li.className = 'reveal';
  li.innerHTML = `<div class="tl-art">${make('panda', { stage, ...extra, hatchesInMs: 60000 })}</div><b>${label}</b><small>${age}</small>`;
  return li;
}));

$('final-egg').innerHTML = make('panda', { stage: 'egg', hatchesInMs: 60000 });

// Live hall of fame (hidden when nobody has played yet)
fetch('/api/leaderboard')
  .then((r) => (r.ok ? r.json() : { pets: [] }))
  .then(({ pets }) => {
    const top = pets.filter((p) => p.alive).slice(0, 5);
    if (!top.length) return;
    $('fame-list').replaceChildren(...top.map((p) => {
      const li = document.createElement('li');
      const art = document.createElement('span');
      art.className = 'f-art';
      art.innerHTML = make(p.species, { stage: p.stage === 'egg' ? 'child' : p.stage, form: p.form });
      const name = document.createElement('span');
      name.className = 'f-name';
      name.textContent = `${p.name} (${p.owner})`;
      const age = document.createElement('span');
      age.className = 'f-age';
      age.textContent = `${p.ageDays}d alive`;
      li.append(art, name, age);
      return li;
    }));
    $('fame').hidden = false;
    document.querySelectorAll('#fame-list li').forEach((el) => el.classList.add('reveal'));
    observe();
  })
  .catch(() => {});

// Scroll reveal
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.15 })
  : null;
function observe() {
  document.querySelectorAll('.steps li, .features article, .scard, .pull, .reveal').forEach((el) => {
    el.classList.add('reveal');
    if (io) io.observe(el); else el.classList.add('in');
  });
}
observe();

// Install buttons appear only when the browser can install the app (or on iOS, where we show the steps).
function updateInstall() {
  const s = installState();
  const show = s === 'prompt' || s === 'ios';
  for (const id of ['nav-install', 'hero-install']) $(id).hidden = !show;
}
for (const id of ['nav-install', 'hero-install']) $(id).addEventListener('click', () => install());
onInstallChange(updateInstall);
updateInstall();

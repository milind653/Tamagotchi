import { petSVG } from './sprites.js';

const $ = (id) => document.getElementById(id);
const make = (species, extra = {}) => petSVG({
  species, stage: 'adult', form: 'normal', alive: true, mood: 'happy', hatchesInMs: 60000, ...extra,
});

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
const demo = { species: 'mochi', mood: 'happy', sleeping: false };
let moodTimer;
function drawDemo() {
  const mood = demo.sleeping ? 'sleeping' : demo.mood;
  $('demo-pet').innerHTML = make(demo.species, { mood });
  $('demo-scene').className = `scene ${demo.sleeping ? 'night' : 'day'}`;
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
const REACTIONS = {
  meal: ['🍙', 'Yum! Oishii!'],
  play: ['⭐', 'Wheee! So fun!'],
  cuddle: ['💗', 'Hehe, that tickles!'],
};
document.querySelector('.demo-buttons').addEventListener('click', (e) => {
  const key = e.target.closest('button[data-demo]')?.dataset.demo;
  if (!key) return;
  clearTimeout(moodTimer);
  if (key === 'sleep') {
    demo.sleeping = !demo.sleeping;
    $('demo-note').textContent = demo.sleeping ? 'Zzz... oyasumi' : 'Good morning!';
    if (demo.sleeping) demoFx('💤');
    drawDemo();
    return;
  }
  if (demo.sleeping) {
    $('demo-note').textContent = 'Shh, Momo is sleeping. Turn the lights on!';
    return;
  }
  const [emoji, note] = REACTIONS[key];
  demoFx(emoji);
  $('demo-note').textContent = note;
  demo.mood = 'happy';
  drawDemo();
});
$('demo-pet').addEventListener('click', () => { demoFx('💗'); $('demo-note').textContent = 'Hi there!'; });
drawDemo();

// Species cards
const SPECIES = [
  ['mochi', 'Mochi', 'もち', 'A squishy rice-cake blob with a little leaf on its head.', '#ffc9d9'],
  ['neko', 'Neko', 'ねこ', 'A sleepy little kitten with whiskers and pointy ears.', '#ffcf99'],
  ['usagi', 'Usagi', 'うさぎ', 'A bouncy bunny with long, floppy ears.', '#d9ccff'],
  ['tori', 'Tori', 'とり', 'A chirpy round chick with a tiny beak.', '#ffe27a'],
];
$('species-row').replaceChildren(...SPECIES.map(([key, name, jp, text, color]) => {
  const card = document.createElement('div');
  card.className = 'sp-card reveal';
  card.style.setProperty('--c', color);
  card.innerHTML = `<div class="sp-art">${make(key)}</div><h3>${name} <span>${jp}</span></h3><p>${text}</p>`;
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
  li.innerHTML = `<div class="tl-art">${make('usagi', { stage, ...extra, hatchesInMs: 60000 })}</div><b>${label}</b><small>${age}</small>`;
  return li;
}));

$('final-egg').innerHTML = make('mochi', { stage: 'egg', hatchesInMs: 60000 });

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

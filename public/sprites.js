const PALETTE = {
  mochi: { body: '#fff1f5', shade: '#ffc9d9', accent: '#ff8fb1' },
  neko: { body: '#ffbf80', shade: '#f29a4a', accent: '#fff3e0' },
  inu: { body: '#f0d0a8', shade: '#c99562', accent: '#ffe8d2' },
  usagi: { body: '#d9ccff', shade: '#b4a0f5', accent: '#fff0f6' },
  tori: { body: '#ffe27a', shade: '#f5c63c', accent: '#ff9f43' },
  panda: { body: '#fbfbfb', shade: '#4a4252', accent: '#c9c2d4' },
  kitsune: { body: '#ffa45c', shade: '#e8782a', accent: '#fff3e3' },
  penguin: { body: '#8a98c4', shade: '#3f4b73', accent: '#ffffff' },
  hamster: { body: '#f6c58d', shade: '#dba064', accent: '#ffb4c2' },
  axolotl: { body: '#ffc4d8', shade: '#ff8fb1', accent: '#ffe6f0' },
};
const INK = '#3b2f3f';
const SCALE = { baby: 0.62, child: 0.78, teen: 0.9, adult: 1 };

const SADISH = new Set(['sad', 'lonely', 'hungry', 'tired']);
const WORRIED = new Set(['sad', 'lonely', 'hungry', 'tired', 'sick', 'grumpy']);
const JOYFUL = new Set(['happy', 'excited', 'love', 'proud']);

function eyes(mood, form) {
  const l = 25, r = 39, y = 36;
  if (mood === 'sleeping' || mood === 'sleepy') {
    return `<path d="M${l - 3} ${y} q3 3 6 0 M${r - 3} ${y} q3 3 6 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  if (mood === 'sick') {
    return `<path d="M${l - 3} ${y - 3} l6 6 m0 -6 l-6 6 M${r - 3} ${y - 3} l6 6 m0 -6 l-6 6" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  }
  if (mood === 'love' || mood === 'excited') {
    return `<path d="M${l} ${y} l2.8 -3.2 l2.8 3.2 l-2.8 3.2z M${r} ${y} l2.8 -3.2 l2.8 3.2 l-2.8 3.2z" fill="#ff5c8a"/>`;
  }
  if (mood === 'happy' || mood === 'proud') {
    return `<path d="M${l - 3} ${y + 2} q3 -5 6 0 M${r - 3} ${y + 2} q3 -5 6 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
  if (mood === 'shy') {
    return `<circle cx="${l}" cy="${y + 1}" r="2.2" fill="${INK}"/><circle cx="${r}" cy="${y + 1}" r="2.2" fill="${INK}"/>
      <path d="M${l - 4} ${y - 5} q4 2 8 0 M${r - 4} ${y - 5} q4 2 8 0" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  }
  if (mood === 'curious') {
    return `<circle cx="${l}" cy="${y}" r="3.1" fill="${INK}"/><circle cx="${r}" cy="${y}" r="2.2" fill="${INK}"/>
      <circle cx="${l + 1}" cy="${y - 1.1}" r="1" fill="#fff"/><circle cx="${r + 0.7}" cy="${y - 0.8}" r="0.7" fill="#fff"/>`;
  }
  if (mood === 'bored') {
    return `<path d="M${l - 3} ${y} h6 M${r - 3} ${y} h6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  if (mood === 'grumpy') {
    return `<circle cx="${l}" cy="${y}" r="2.6" fill="${INK}"/><circle cx="${r}" cy="${y}" r="2.6" fill="${INK}"/>
      <path d="M${l - 4} ${y - 6} l7 3 M${r + 4} ${y - 6} l-7 3" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  }

  let out = `<circle cx="${l}" cy="${y}" r="2.6" fill="${INK}"/><circle cx="${r}" cy="${y}" r="2.6" fill="${INK}"/>
    <circle cx="${l + 0.9}" cy="${y - 1}" r="0.9" fill="#fff"/><circle cx="${r + 0.9}" cy="${y - 1}" r="0.9" fill="#fff"/>`;
  if (SADISH.has(mood)) {
    out += `<path d="M${l - 4} ${y - 4} l7 -3 M${r + 4} ${y - 4} l-7 -3" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
    if (mood === 'sad' || mood === 'lonely') out += `<path d="M${l - 2} ${y + 4} q-1 4 0 5 q1 -1 0 -5z" fill="#6ec1ff"/>`;
  }
  if (form === 'rascal' && !WORRIED.has(mood)) {
    out += `<path d="M${l - 4} ${y - 7} l7 3 M${r + 4} ${y - 7} l-7 3" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return out;
}

function mouth(mood, form) {
  const y = 44;
  if (mood === 'sleeping' || mood === 'sleepy') return `<path d="M30 ${y} q2 1.5 4 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  if (mood === 'hungry') return `<ellipse cx="32" cy="${y + 1}" rx="3" ry="3.6" fill="${INK}"><animate attributeName="ry" values="3.6;2;3.6" dur="1s" repeatCount="indefinite"/></ellipse>`;
  if (mood === 'sad' || mood === 'lonely' || mood === 'sick' || mood === 'tired') {
    return `<path d="M28 ${y + 3} q4 -4 8 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  }
  if (mood === 'grumpy') return `<path d="M27 ${y + 2} h10" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  if (mood === 'bored') return `<path d="M29 ${y + 1} h6" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  if (mood === 'shy') return `<path d="M29 ${y} q3 2 6 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  if (mood === 'curious') return `<ellipse cx="32" cy="${y + 1}" rx="2.2" ry="2.6" fill="${INK}"/>`;
  if (mood === 'excited' || mood === 'love') {
    return `<path d="M26 ${y - 1} q6 9 12 0z" fill="${INK}"/><path d="M29 ${y + 2.5} q3 2.2 6 0" fill="#ff7b9c"/>`;
  }
  if (mood === 'proud' || mood === 'happy') {
    return `<path d="M27 ${y - 1} q5 7 10 0z" fill="${INK}"/><path d="M29.5 ${y + 2} q2.5 2 5 0" fill="#ff7b9c"/>`;
  }
  if (form === 'rascal') return `<path d="M27 ${y + 1} l2.5 -2 l2.5 2 l2.5 -2 l2.5 2 l2.5 -2" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
  return `<path d="M28 ${y} q4 3.5 8 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
}

function extras(species, c) {
  switch (species) {
    case 'neko':
      return `<path d="M15 24 L17 9 L28 17z M49 24 L47 9 L36 17z" fill="${c.body}" stroke="${c.shade}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M18 20 L19 13 L24 17z M46 20 L45 13 L40 17z" fill="#ffb3c6"/>
        <path d="M14 42 h-8 M14 45 l-7 3 M50 42 h8 M50 45 l7 3" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`;
    case 'inu':
      return `<ellipse cx="18" cy="18" rx="7" ry="10" fill="${c.body}" stroke="${c.shade}" stroke-width="1.5" transform="rotate(-18 18 18)"/>
        <ellipse cx="46" cy="18" rx="7" ry="10" fill="${c.body}" stroke="${c.shade}" stroke-width="1.5" transform="rotate(18 46 18)"/>
        <ellipse cx="18" cy="20" rx="3.5" ry="6" fill="#ffb3c6" transform="rotate(-18 18 20)"/>
        <ellipse cx="46" cy="20" rx="3.5" ry="6" fill="#ffb3c6" transform="rotate(18 46 20)"/>
        <ellipse cx="32" cy="52" rx="5" ry="3" fill="${c.shade}" opacity=".5"/>`;
    case 'usagi':
      return `<ellipse cx="22" cy="11" rx="5" ry="13" fill="${c.body}" stroke="${c.shade}" stroke-width="1.5"/>
        <ellipse cx="42" cy="11" rx="5" ry="13" fill="${c.body}" stroke="${c.shade}" stroke-width="1.5" transform="rotate(8 42 11)"/>
        <ellipse cx="22" cy="12" rx="2.2" ry="8" fill="#ffb3c6"/><ellipse cx="42" cy="12" rx="2.2" ry="8" fill="#ffb3c6" transform="rotate(8 42 12)"/>`;
    case 'tori':
      return `<path d="M29 15 q-3 -8 -7 -9 q1 6 4 10z M35 15 q3 -8 7 -9 q-1 6 -4 10z" fill="${c.shade}"/>
        <path d="M28 40 L36 40 L32 46z" fill="${c.accent}" stroke="#e07b13" stroke-width="0.8" stroke-linejoin="round"/>
        <path d="M8 38 q-4 10 6 14 M56 38 q4 10 -6 14" fill="${c.shade}" stroke="${c.shade}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
    default:
      return `<path d="M32 12 q-5 -7 -10 -4 q3 6 10 4z" fill="#8fd694" stroke="#5bb36a" stroke-width="1"/>`;
  }
}

function egg(species, hatching) {
  const c = PALETTE[species];
  return `<g class="${hatching ? 'egg shake' : 'egg wobble'}">
    <ellipse cx="32" cy="56" rx="14" ry="3" fill="#0000001a"/>
    <path d="M32 6 C46 6 52 30 52 40 C52 52 43 58 32 58 C21 58 12 52 12 40 C12 30 18 6 32 6z" fill="${c.body}" stroke="${c.shade}" stroke-width="2"/>
    <circle cx="25" cy="30" r="4" fill="${c.accent}"/><circle cx="39" cy="38" r="5" fill="${c.shade}"/>
    <circle cx="28" cy="47" r="3" fill="${c.accent}"/><circle cx="40" cy="22" r="2.5" fill="${c.accent}"/>
    ${hatching ? `<path d="M22 20 l5 5 l-4 4 l6 5" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linejoin="round"/>` : ''}
  </g>`;
}

function ghost(pet) {
  const c = PALETTE[pet.species];
  return `<g class="float">
    <path d="M32 12 C46 12 50 26 50 40 L50 54 L43 49 L37 54 L32 49 L27 54 L21 49 L14 54 L14 40 C14 26 18 12 32 12z" fill="#ffffffcc" stroke="${c.shade}" stroke-width="1.5"/>
    <path d="M24 31 l6 6 m0 -6 l-6 6 M36 31 l6 6 m0 -6 l-6 6" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="32" cy="45" rx="3" ry="2.4" fill="${INK}"/>
    <ellipse cx="32" cy="6" rx="9" ry="2.6" fill="none" stroke="#ffd34d" stroke-width="2"/>
  </g>`;
}

function animFor(mood) {
  if (mood === 'sleeping' || mood === 'sleepy') return 'breathe';
  if (mood === 'excited' || mood === 'love') return 'bounce';
  if (mood === 'happy' || mood === 'proud') return 'bounce';
  if (mood === 'shy') return 'idle';
  return 'idle';
}

export function petSVG(pet) {
  if (pet.stage === 'egg') return svgWrap(egg(pet.species, pet.hatchesInMs < 15000));
  if (!pet.alive) return svgWrap(ghost(pet));

  const c = PALETTE[pet.species];
  const s = SCALE[pet.stage] ?? 1;
  const mood = pet.mood;
  const anim = animFor(mood);
  const tint = mood === 'sick' ? 'filter:saturate(.5) hue-rotate(60deg) brightness(1.05)'
    : mood === 'tired' ? 'filter:saturate(.7) brightness(.95)'
    : mood === 'grumpy' ? 'filter:saturate(1.1) hue-rotate(-8deg)'
    : '';
  const bow = pet.stage === 'adult' && pet.form === 'angel'
    ? `<path d="M32 20 l-7 -4 v8z M32 20 l7 -4 v8z" fill="#ff6f9c"/><circle cx="32" cy="20" r="2" fill="#ff3d7f"/>` : '';
  const teen = pet.stage === 'teen' || pet.stage === 'adult'
    ? `<path d="M14 54 q-4 -2 -5 -8 M50 54 q4 -2 5 -8" stroke="${c.shade}" stroke-width="3" fill="none" stroke-linecap="round"/>` : '';
  const blushBoost = JOYFUL.has(mood) || mood === 'shy' ? 'opacity=".85"' : 'opacity=".55"';

  const body = `<g class="${anim}" style="transform-origin:32px 56px;${tint}">
    <g transform="translate(32 56) scale(${s}) translate(-32 -56)">
      <ellipse cx="32" cy="57" rx="19" ry="3.2" fill="#0000001a"/>
      ${extras(pet.species, c)}
      ${teen}
      <ellipse cx="32" cy="38" rx="22" ry="19" fill="${c.body}" stroke="${c.shade}" stroke-width="1.8"/>
      <ellipse cx="32" cy="46" rx="14" ry="8" fill="${c.shade}" opacity=".22"/>
      <ellipse cx="18" cy="42" rx="3.4" ry="2.2" fill="#ff8fb1" ${blushBoost}/>
      <ellipse cx="46" cy="42" rx="3.4" ry="2.2" fill="#ff8fb1" ${blushBoost}/>
      ${eyes(mood, pet.form)}
      ${mouth(mood, pet.form)}
      ${bow}
    </g>
  </g>`;
  const zzz = (mood === 'sleeping' || mood === 'sleepy')
    ? `<text class="zzz" x="46" y="18" font-size="9" fill="${INK}">z</text><text class="zzz z2" x="52" y="10" font-size="7" fill="${INK}">z</text>` : '';
  const sparkle = pet.stage === 'adult' && pet.form === 'angel'
    ? `<path class="sparkle" d="M8 14 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5z" fill="#ffd34d"/>` : '';
  const hearts = mood === 'love' || mood === 'excited'
    ? `<text x="8" y="16" font-size="8" fill="#ff5c8a">♡</text><text x="50" y="12" font-size="6" fill="#ff8fb1">♡</text>` : '';
  return svgWrap(body + zzz + sparkle + hearts);
}

export function poopSVG() {
  return `<svg viewBox="0 0 24 24" class="poop"><path d="M12 3 q3 3 1 5 q5 0 5 4 q4 1 4 5 q0 4 -6 4 h-8 q-6 0 -6 -4 q0 -4 4 -5 q0 -4 5 -4 q-2 -2 1 -5z" fill="#a8693a" stroke="#6e4220" stroke-width="1"/><circle cx="9" cy="15" r="1.2" fill="#fff"/><circle cx="15" cy="15" r="1.2" fill="#fff"/></svg>`;
}

function svgWrap(inner) {
  return `<svg viewBox="0 0 64 64" class="pet-svg" role="img" aria-label="Your pet">${inner}</svg>`;
}

export const SPECIES_PALETTE = PALETTE;

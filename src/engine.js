// Pure game simulation. No I/O: every function takes a pet row and returns changes,
// so the rules can be unit-tested without a database.

import { chatWithPet } from './chat.js';

export const MINUTE = 60_000;
export const EGG_MS = MINUTE; // egg hatches after one minute
export const PET_DAY_MS = 60 * MINUTE; // one "pet day" is one real hour
export const MAX_SIM_MS = 12 * 60 * MINUTE; // offline time simulated per request
export const MAX_WEIGHT_FOR_SNACK = 30;

export const SPECIES = {
  mochi: { name: 'Mochi', jp: 'もち', trait: 'A squishy rice-cake blob.' },
  neko: { name: 'Neko', jp: 'ねこ', trait: 'A cuddly 3D kitten with soft whiskers and pink paw pads.', model3d: true },
  inu: { name: 'Inu', jp: 'いぬ', trait: 'A round 3D puppy with floppy ears and a wagging tail.', model3d: true },
  usagi: { name: 'Usagi', jp: 'うさぎ', trait: 'A bouncy long-eared bunny.' },
  tori: { name: 'Tori', jp: 'とり', trait: 'A chirpy round chick.' },
  panda: { name: 'Panda', jp: 'パンダ', trait: 'A cuddly 3D cub who adores hugs.', model3d: true },
  kitsune: { name: 'Kitsune', jp: 'きつね', trait: 'A fluffy 3D fox kit with a big swishy tail.', model3d: true },
  penguin: { name: 'Pen', jp: 'ペンギン', trait: 'A waddling 3D penguin chick with tiny flippers.', model3d: true },
  hamster: { name: 'Hamu', jp: 'ハムスター', trait: 'A chubby 3D hamster hugging a sunflower seed.', model3d: true },
  axolotl: { name: 'Uparupa', jp: 'ウーパー', trait: 'A smiling 3D axolotl with fluffy gills.', model3d: true },
};

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function stageForAge(ageMs) {
  if (ageMs < EGG_MS) return 'egg';
  const days = ageMs / PET_DAY_MS;
  if (days < 1) return 'baby';
  if (days < 3) return 'child';
  if (days < 7) return 'teen';
  return 'adult';
}

export function formForMistakes(mistakes) {
  if (mistakes <= 2) return 'angel';
  if (mistakes <= 6) return 'normal';
  return 'rascal';
}

export function newPet({ name, species, now }) {
  if (typeof name !== 'string') throw new GameError('Give your pet a name.');
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 1 || clean.length > 12) throw new GameError('Name must be 1-12 characters.');
  if (!/^[\p{L}\p{N} '_-]+$/u.test(clean)) throw new GameError('Name has unsupported characters.');
  if (!SPECIES[species]) throw new GameError('Pick one of the available species.');
  return {
    name: clean,
    species,
    stage: 'egg',
    form: null,
    born_at: now,
    last_tick: now + EGG_MS,
    hunger: 70,
    happiness: 70,
    energy: 100,
    hygiene: 100,
    health: 100,
    poop: 0,
    digest: 0,
    sleeping: 0,
    sick: 0,
    weight: 5,
    mistakes: 0,
    alive: 1,
    died_at: null,
    cause: null,
    games_played: 0,
    games_won: 0,
    meals: 0,
  };
}

function step(p, at, events) {
  const before = { hunger: p.hunger, happiness: p.happiness };

  if (p.sleeping) {
    p.energy += 1;
    p.hunger -= 0.12;
    p.happiness -= 0.03;
    p.hygiene -= 0.03;
    if (p.energy >= 100) {
      p.sleeping = 0;
      events.push({ at, text: `${p.name} woke up refreshed.` });
    }
  } else {
    p.energy -= 0.15;
    p.hunger -= 0.4;
    p.happiness -= 0.25;
    p.hygiene -= 0.08 + 0.05 * p.poop;
    p.digest += 1;
    if (p.digest >= 40 && p.poop < 4) {
      p.digest = 0;
      p.poop += 1;
      events.push({ at, text: `${p.name} made a mess.` });
    }
  }

  p.energy = clamp(p.energy);
  p.hunger = clamp(p.hunger);
  p.happiness = clamp(p.happiness);
  p.hygiene = clamp(p.hygiene);

  if (!p.sleeping && p.energy <= 0) {
    p.sleeping = 1;
    events.push({ at, text: `${p.name} was exhausted and fell asleep.` });
  }
  if (before.hunger > 0 && p.hunger <= 0) {
    p.mistakes += 1;
    events.push({ at, text: `${p.name} is starving!` });
  }
  if (before.happiness > 0 && p.happiness <= 0) {
    p.mistakes += 1;
    events.push({ at, text: `${p.name} feels lonely.` });
  }
  if (!p.sick && (p.poop >= 3 || p.hygiene < 20)) {
    p.sick = 1;
    p.mistakes += 1;
    events.push({ at, text: `${p.name} got sick from the dirt.` });
  }

  let drain = 0;
  if (p.hunger <= 0) drain += 0.35;
  if (p.sick) drain += 0.4;
  if (p.hygiene < 10) drain += 0.15;
  if (p.happiness <= 0) drain += 0.1;
  if (drain > 0) p.health -= drain;
  else if (p.hunger > 30 && p.hygiene > 30) p.health += 0.2;
  p.health = clamp(p.health);

  if (p.health <= 0) {
    p.alive = 0;
    p.died_at = at;
    p.cause = p.sick ? 'illness' : p.hunger <= 0 ? 'starvation' : 'neglect';
    events.push({ at, text: `${p.name} passed away (${p.cause}). Sayonara...` });
  }
}

// Advance a pet to `now`. Returns { pet, events }. Never mutates the input.
export function tick(input, now) {
  const p = { ...input };
  const events = [];
  if (!p.alive) return { pet: p, events };

  const hatchAt = p.born_at + EGG_MS;
  if (now >= hatchAt && p.stage === 'egg') {
    events.push({ at: hatchAt, text: `${p.name} hatched from the egg!` });
  }

  if (now > p.last_tick) {
    const capped = now - p.last_tick > MAX_SIM_MS;
    const end = capped ? p.last_tick + MAX_SIM_MS : now;
    let t = p.last_tick;
    while (t + MINUTE <= end && p.alive) {
      t += MINUTE;
      step(p, t, events);
    }
    p.last_tick = capped || !p.alive ? now : t;
  }

  const prevStage = p.stage;
  const stage = stageForAge((p.alive ? now : p.died_at) - p.born_at);
  if (stage !== p.stage) {
    p.stage = stage;
    if (stage === 'adult' && !p.form) p.form = formForMistakes(p.mistakes);
    if (stage !== 'egg' && prevStage !== 'egg') {
      events.push({ at: now, text: `${p.name} grew into a ${stage}!` });
    }
  }
  return { pet: p, events };
}

function requireAwake(p) {
  if (p.stage === 'egg') throw new GameError('The egg has not hatched yet.');
  if (!p.alive) throw new GameError(`${p.name} is no longer with us.`);
  if (p.sleeping) throw new GameError(`${p.name} is sleeping. Turn the lights on first.`);
}

// Each action mutates a copy and returns { pet, message, extra? }.
export const actions = {
  feed(input, { kind = 'meal' } = {}) {
    const p = { ...input };
    requireAwake(p);
    if (kind === 'meal') {
      if (p.hunger >= 90) throw new GameError(`${p.name} is not hungry.`);
      p.hunger = clamp(p.hunger + 35);
      p.happiness = clamp(p.happiness + 3);
      p.weight += 1;
      p.meals += 1;
      return { pet: p, message: `${p.name} ate a hearty meal. Oishii!`, log: `Fed a meal to ${p.name}.` };
    }
    if (kind === 'snack') {
      if (p.weight >= MAX_WEIGHT_FOR_SNACK) {
        throw new GameError(`${p.name} is too heavy for snacks. Try playing!`);
      }
      p.hunger = clamp(p.hunger + 8);
      p.happiness = clamp(p.happiness + 15);
      p.weight += 2;
      return { pet: p, message: `${p.name} munched a sweet snack!`, log: `Gave ${p.name} a snack.` };
    }
    throw new GameError('Unknown food.');
  },

  play(input, { guess } = {}, rng = Math.random) {
    const p = { ...input };
    requireAwake(p);
    if (!['left', 'right'].includes(guess)) throw new GameError('Choose left or right.');
    if (p.sick) throw new GameError(`${p.name} is too sick to play.`);
    if (p.energy < 15) throw new GameError(`${p.name} is too tired to play.`);
    const answer = rng() < 0.5 ? 'left' : 'right';
    const won = answer === guess;
    p.happiness = clamp(p.happiness + (won ? 30 : 10));
    p.energy = clamp(p.energy - 12);
    p.hunger = clamp(p.hunger - 6);
    p.hygiene = clamp(p.hygiene - 3);
    p.weight = Math.max(3, p.weight - 1);
    p.games_played += 1;
    if (won) p.games_won += 1;
    return {
      pet: p,
      message: won ? `${p.name} looked ${answer} too. You win!` : `${p.name} looked ${answer}. Better luck next time!`,
      extra: { won, answer },
      log: `Played left/right with ${p.name} and ${won ? 'won' : 'lost'}.`,
    };
  },

  cuddle(input) {
    const p = { ...input };
    requireAwake(p);
    p.happiness = clamp(p.happiness + 6);
    return { pet: p, message: `${p.name} snuggles up to you.`, log: null };
  },

  clean(input) {
    const p = { ...input };
    requireAwake(p);
    if (p.poop === 0) throw new GameError('Nothing to clean up.');
    p.poop = 0;
    p.hygiene = clamp(p.hygiene + 20);
    return { pet: p, message: 'All cleaned up. Sparkly!', log: `Cleaned up after ${p.name}.` };
  },

  bath(input) {
    const p = { ...input };
    requireAwake(p);
    if (p.hygiene >= 95) throw new GameError(`${p.name} is already squeaky clean.`);
    p.hygiene = 100;
    p.poop = 0;
    p.happiness = clamp(p.happiness - 4);
    return { pet: p, message: `${p.name} had a lovely bath.`, log: `Gave ${p.name} a bath.` };
  },

  medicine(input) {
    const p = { ...input };
    requireAwake(p);
    if (!p.sick) throw new GameError(`${p.name} is not sick.`);
    p.sick = 0;
    p.health = clamp(p.health + 15);
    p.happiness = clamp(p.happiness - 5);
    return { pet: p, message: `${p.name} took the medicine and feels better.`, log: `Gave ${p.name} medicine.` };
  },

  light(input) {
    const p = { ...input };
    if (p.stage === 'egg') throw new GameError('The egg has not hatched yet.');
    if (!p.alive) throw new GameError(`${p.name} is no longer with us.`);
    if (p.sleeping) {
      p.sleeping = 0;
      return { pet: p, message: `Lights on. ${p.name} wakes up.`, log: `Woke ${p.name} up.` };
    }
    if (p.energy >= 90) throw new GameError(`${p.name} is not sleepy.`);
    p.sleeping = 1;
    return { pet: p, message: `Lights off. Oyasumi, ${p.name}.`, log: `Put ${p.name} to bed.` };
  },

  chat(input, { text } = {}) {
    const p = { ...input };
    if (typeof text !== 'string') throw new GameError('Say something to your pet.');
    const clean = text.trim().replace(/\s+/g, ' ');
    if (clean.length < 1) throw new GameError('Say something to your pet.');
    if (clean.length > 140) throw new GameError('Keep it under 140 characters.');
    return chatWithPet(p, clean);
  },
};

export function needs(p) {
  if (!p.alive) return [];
  const list = [];
  if (p.stage === 'egg') return list;
  if (p.sick) list.push('sick');
  if (p.hunger < 30) list.push('hungry');
  if (p.poop > 0) list.push('dirty');
  if (p.happiness < 30) list.push('lonely');
  if (p.energy < 20 && !p.sleeping) list.push('tired');
  return list;
}

export const EMOTIONS = {
  dead: { label: 'Gone', emoji: '👻' },
  egg: { label: 'Waiting', emoji: '🥚' },
  sleeping: { label: 'Sleepy', emoji: '💤' },
  sick: { label: 'Sick', emoji: '🤒' },
  hungry: { label: 'Hungry', emoji: '🥺' },
  tired: { label: 'Tired', emoji: '🥱' },
  sad: { label: 'Sad', emoji: '😢' },
  lonely: { label: 'Lonely', emoji: '💭' },
  grumpy: { label: 'Grumpy', emoji: '😤' },
  bored: { label: 'Bored', emoji: '😐' },
  shy: { label: 'Shy', emoji: '😳' },
  curious: { label: 'Curious', emoji: '🤔' },
  excited: { label: 'Excited', emoji: '🤩' },
  proud: { label: 'Proud', emoji: '😌' },
  love: { label: 'Loved', emoji: '💗' },
  happy: { label: 'Happy', emoji: '😊' },
  okay: { label: 'Calm', emoji: '🙂' },
  sleepy: { label: 'Drowsy', emoji: '😴' },
};

export function mood(p) {
  if (!p.alive) return 'dead';
  if (p.stage === 'egg') return 'egg';
  if (p.sleeping) return 'sleeping';
  if (p.sick) return 'sick';
  if (p.hunger < 20) return 'hungry';
  if (p.energy < 18) return 'tired';
  if (p.happiness < 20) return 'sad';
  if (p.happiness < 32) return 'lonely';
  if (p.poop >= 2 || (p.poop > 0 && p.hygiene < 40)) return 'grumpy';
  if (p.happiness > 88 && p.energy > 65 && p.hunger > 45) return 'excited';
  if (p.happiness > 78 && p.hunger > 50) return 'happy';
  if (p.happiness < 48 && p.energy > 40 && p.hunger > 40) return 'bored';
  if (p.stage === 'baby' && p.happiness > 55) return 'shy';
  return 'okay';
}

export function toView(p, now) {
  const end = p.alive ? now : p.died_at;
  const ageMs = Math.max(0, end - p.born_at);
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    speciesInfo: SPECIES[p.species],
    stage: p.stage,
    form: p.form,
    alive: !!p.alive,
    sleeping: !!p.sleeping,
    sick: !!p.sick,
    poop: p.poop,
    weight: Math.round(p.weight),
    stats: {
      hunger: Math.round(p.hunger),
      happiness: Math.round(p.happiness),
      energy: Math.round(p.energy),
      hygiene: Math.round(p.hygiene),
      health: Math.round(p.health),
    },
    ageDays: Math.floor(ageMs / PET_DAY_MS),
    ageMs,
    hatchesInMs: p.stage === 'egg' ? Math.max(0, p.born_at + EGG_MS - now) : 0,
    mood: mood(p),
    emotion: EMOTIONS[mood(p)] ?? EMOTIONS.okay,
    needs: needs(p),
    careMistakes: p.mistakes,
    gamesPlayed: p.games_played,
    gamesWon: p.games_won,
    bornAt: p.born_at,
    diedAt: p.died_at,
    cause: p.cause,
  };
}

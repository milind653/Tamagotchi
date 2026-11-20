import test from 'node:test';
import assert from 'node:assert/strict';
import { newPet, tick, toView, actions, GameError, MINUTE, EGG_MS, PET_DAY_MS, MAX_SIM_MS, stageForAge, formForMistakes } from '../src/engine.js';

const T0 = 1_700_000_000_000;
const fresh = () => newPet({ name: 'Momo', species: 'mochi', now: T0 });
const hatched = () => tick(fresh(), T0 + EGG_MS).pet;

test('validates names and species', () => {
  assert.throws(() => newPet({ name: '', species: 'mochi', now: T0 }), GameError);
  assert.throws(() => newPet({ name: 'x'.repeat(13), species: 'mochi', now: T0 }), GameError);
  assert.throws(() => newPet({ name: '<b>', species: 'mochi', now: T0 }), GameError);
  assert.throws(() => newPet({ name: 'Momo', species: 'dragon', now: T0 }), GameError);
  assert.equal(newPet({ name: 'もも', species: 'neko', now: T0 }).name, 'もも');
});

test('egg does not decay and hatches after a minute', () => {
  const { pet } = tick(fresh(), T0 + 30_000);
  assert.equal(pet.stage, 'egg');
  assert.equal(pet.hunger, 70);
  const hatchedPet = tick(fresh(), T0 + EGG_MS + 1000);
  assert.equal(hatchedPet.pet.stage, 'baby');
  assert.ok(hatchedPet.events.some((e) => /hatched/.test(e.text)));
});

test('stats decay over time and tick is pure', () => {
  const base = hatched();
  const { pet } = tick(base, base.last_tick + 30 * MINUTE);
  assert.ok(pet.hunger < base.hunger);
  assert.ok(pet.happiness < base.happiness);
  assert.equal(base.hunger, 70);
});

test('partial minutes are preserved between ticks', () => {
  const base = hatched();
  const a = tick(base, base.last_tick + 90_000).pet;
  assert.equal(a.last_tick, base.last_tick + MINUTE);
});

test('pet poops and gets sick when never cleaned, then recovers with medicine', () => {
  let p = hatched();
  p.hunger = 100; p.happiness = 100;
  p = tick(p, p.last_tick + 130 * MINUTE).pet;
  assert.ok(p.poop >= 3);
  assert.equal(p.sick, 1);
  p.sleeping = 0;
  const cured = actions.medicine(p).pet;
  assert.equal(cured.sick, 0);
});

test('neglect eventually kills the pet and records a cause', () => {
  const base = hatched();
  const { pet, events } = tick(base, base.last_tick + 12 * 60 * MINUTE);
  assert.equal(pet.alive, 0);
  assert.ok(pet.cause);
  assert.ok(events.some((e) => e.text.includes('passed away')));
  const again = tick(pet, pet.last_tick + 100 * MINUTE);
  assert.deepEqual(again.pet, pet);
});

test('pets abandoned longer than max simulation die and do not stay alive', () => {
  const base = hatched();
  const returnAt = base.last_tick + 7 * 24 * 60 * MINUTE; // owner never came back for a week
  const { pet, events } = tick(base, returnAt);
  assert.equal(pet.alive, 0);
  assert.ok(pet.cause);
  assert.ok(pet.died_at <= base.last_tick + MAX_SIM_MS, 'death is recorded inside the simulated window');
  assert.ok(pet.died_at < returnAt);
  assert.ok(events.some((e) => e.text.includes('passed away')));
  const view = toView(pet, returnAt);
  assert.equal(view.alive, false);
  assert.ok(view.ageMs <= MAX_SIM_MS + EGG_MS, 'age must not keep growing while abandoned');
});

test('absence beyond max sim kills even a pampered pet left sleeping', () => {
  const base = hatched();
  base.hunger = 100;
  base.happiness = 100;
  base.hygiene = 100;
  base.health = 100;
  base.poop = 0;
  base.digest = 0;
  base.sleeping = 1;
  base.energy = 0;
  const { pet } = tick(base, base.last_tick + MAX_SIM_MS + MINUTE);
  assert.equal(pet.alive, 0);
  assert.ok(pet.cause);
  assert.ok(pet.died_at <= base.last_tick + MAX_SIM_MS);
});

test('a well cared-for pet survives', () => {
  let p = hatched();
  let now = p.last_tick;
  for (let i = 0; i < 60; i++) {
    now += 10 * MINUTE;
    p = tick(p, now).pet;
    if (p.sleeping) p = actions.light(p).pet;
    for (const fn of [() => actions.feed(p, { kind: 'meal' }), () => actions.clean(p), () => actions.medicine(p), () => actions.cuddle(p)]) {
      try { p = fn().pet; } catch (e) { if (!(e instanceof GameError)) throw e; }
    }
    if (p.energy < 40) { try { p = actions.light(p).pet; } catch { /* not sleepy */ } }
  }
  assert.equal(p.alive, 1);
  assert.ok(p.health > 80);
});

test('feeding rules', () => {
  const p = hatched();
  p.hunger = 95;
  assert.throws(() => actions.feed(p, { kind: 'meal' }), /not hungry/);
  p.hunger = 20;
  const r = actions.feed(p, { kind: 'meal' });
  assert.equal(r.pet.hunger, 55);
  assert.equal(r.pet.weight, 6);
  assert.throws(() => actions.feed(p, { kind: 'pizza' }), GameError);
  p.weight = 30;
  assert.throws(() => actions.feed(p, { kind: 'snack' }), /too heavy/);
});

test('play uses rng and costs energy', () => {
  const p = hatched();
  const win = actions.play(p, { guess: 'left' }, () => 0.1);
  assert.equal(win.extra.won, true);
  assert.equal(win.pet.games_won, 1);
  assert.ok(win.pet.energy < p.energy);
  const lose = actions.play(p, { guess: 'right' }, () => 0.1);
  assert.equal(lose.extra.won, false);
  assert.throws(() => actions.play(p, { guess: 'up' }), GameError);
  p.energy = 5;
  assert.throws(() => actions.play(p, { guess: 'left' }), /tired/);
});

test('sleeping blocks care but allows lights on; sleeping restores energy', () => {
  let p = hatched();
  p.energy = 30;
  p = actions.light(p).pet;
  assert.equal(p.sleeping, 1);
  assert.throws(() => actions.feed(p), /sleeping/);
  const slept = tick(p, p.last_tick + 80 * MINUTE).pet;
  assert.equal(slept.sleeping, 0);
  assert.ok(slept.energy > 95);
  assert.throws(() => actions.light(slept), /not sleepy/);
});

test('actions are rejected while an egg', () => {
  assert.throws(() => actions.feed(fresh()), /not hatched/);
  assert.throws(() => actions.light(fresh()), /not hatched/);
});

test('stages and evolution form', () => {
  assert.equal(stageForAge(0), 'egg');
  assert.equal(stageForAge(EGG_MS), 'baby');
  assert.equal(stageForAge(2 * PET_DAY_MS), 'child');
  assert.equal(stageForAge(5 * PET_DAY_MS), 'teen');
  assert.equal(stageForAge(8 * PET_DAY_MS), 'adult');
  assert.equal(formForMistakes(0), 'angel');
  assert.equal(formForMistakes(4), 'normal');
  assert.equal(formForMistakes(9), 'rascal');
  const p = { ...hatched(), mistakes: 0 };
  const grown = tick({ ...p, last_tick: p.born_at + 8 * PET_DAY_MS }, p.born_at + 8 * PET_DAY_MS).pet;
  assert.equal(grown.stage, 'adult');
  assert.equal(grown.form, 'angel');
});

test('every species has a display name and Japanese name', async () => {
  const { SPECIES } = await import('../src/engine.js');
  assert.ok(Object.keys(SPECIES).length >= 10);
  for (const [key, info] of Object.entries(SPECIES)) {
    assert.ok(info.name && info.jp && info.trait, key);
    assert.doesNotThrow(() => newPet({ name: 'Momo', species: key, now: T0 }));
  }
  for (const key of ['panda', 'kitsune', 'penguin', 'hamster', 'axolotl', 'neko', 'inu', 'shiba', 'mike']) assert.equal(SPECIES[key].model3d, true);
  assert.equal(SPECIES.shiba.real, true);
  assert.equal(SPECIES.mike.real, true);
});

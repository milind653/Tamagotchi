import test from 'node:test';
import assert from 'node:assert/strict';
import { mood, EMOTIONS, EGG_MS, tick, newPet } from '../src/engine.js';

const T0 = 1_700_000_000_000;
const hatched = () => tick(newPet({ name: 'Momo', species: 'mochi', now: T0 }), T0 + EGG_MS).pet;

test('mood covers richer emotional states', () => {
  const p = hatched();
  p.happiness = 95; p.energy = 90; p.hunger = 80; p.poop = 0; p.sick = 0; p.sleeping = 0;
  assert.equal(mood(p), 'excited');
  assert.ok(EMOTIONS.excited.emoji);

  p.happiness = 28; p.energy = 80; p.hunger = 70;
  assert.equal(mood(p), 'lonely');

  p.happiness = 70; p.poop = 3; p.hygiene = 30;
  assert.equal(mood(p), 'grumpy');

  p.poop = 0; p.hygiene = 90; p.happiness = 40; p.energy = 70; p.hunger = 70;
  assert.equal(mood(p), 'bored');

  p.energy = 10;
  assert.equal(mood(p), 'tired');
});

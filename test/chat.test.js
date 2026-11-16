import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, mood, EMOTIONS, EGG_MS, tick, newPet } from '../src/engine.js';

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

test('chat replies and boosts happiness', () => {
  const p = hatched();
  p.happiness = 50;
  const res = actions.chat(p, { text: 'I love you!' });
  assert.match(res.extra.reply, /love|Daisuki|nuzzle|favourite|heart/i);
  assert.equal(res.extra.emotion, 'love');
  assert.ok(res.pet.happiness > 50);
  assert.match(res.log, /You told Momo/);
});

test('chat rejects empty messages and handles sleeping pets', () => {
  const p = hatched();
  assert.throws(() => actions.chat(p, { text: '   ' }), /Say something/);
  p.sleeping = 1;
  const dream = actions.chat(p, { text: 'Good night' });
  assert.equal(dream.extra.emotion, 'sleepy');
  assert.match(dream.extra.reply, /[Zz]|dream|mumble/i);
});

test('scolding makes the pet sad', () => {
  const p = hatched();
  p.happiness = 60;
  const res = actions.chat(p, { text: 'You are stupid and bad' });
  assert.equal(res.extra.emotion, 'sad');
  assert.ok(res.pet.happiness < 60);
});

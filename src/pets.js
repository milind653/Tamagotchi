import { query } from './db.js';
import { EGG_MS, GameError, actions, newPet, tick, toView } from './engine.js';

const PET_COLS = [
  'user_id', 'name', 'species', 'stage', 'form', 'born_at', 'last_tick', 'hunger', 'happiness',
  'energy', 'hygiene', 'health', 'poop', 'digest', 'sleeping', 'sick', 'weight', 'mistakes',
  'alive', 'died_at', 'cause', 'games_played', 'games_won', 'meals',
];
const UPDATABLE = PET_COLS.filter((c) => c !== 'user_id');

// Serialises read-modify-write cycles per user so rapid taps cannot lose updates.
const locks = new Map();
export function withUserLock(userId, fn) {
  const prev = locks.get(userId) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(userId, tail);
  tail.then(() => {
    if (locks.get(userId) === tail) locks.delete(userId);
  });
  return run;
}

async function addEvents(petId, events) {
  for (const e of events) {
    await query('INSERT INTO pet_events (pet_id, at, text) VALUES (?, ?, ?)', petId, e.at, e.text);
  }
}

async function save(pet) {
  const sets = UPDATABLE.map((c) => `${c} = ?`).join(', ');
  await query(`UPDATE pets SET ${sets} WHERE id = ?`, ...UPDATABLE.map((c) => pet[c]), pet.id);
}

// The user's living pet, or their most recently deceased one (so the UI can show the farewell).
async function currentRow(userId) {
  const living = await query('SELECT * FROM pets WHERE user_id = ? AND alive = 1 LIMIT 1', userId);
  if (living.length) return living[0];
  const last = await query('SELECT * FROM pets WHERE user_id = ? ORDER BY id DESC LIMIT 1', userId);
  return last[0] ?? null;
}

export async function getCurrentPet(userId, now = Date.now()) {
  return withUserLock(userId, async () => {
    const row = await currentRow(userId);
    if (!row) return null;
    const { pet, events } = tick(row, now);
    if (events.length || pet.last_tick !== row.last_tick || pet.stage !== row.stage) {
      await save(pet);
      await addEvents(pet.id, events);
    }
    return toView(pet, now);
  });
}

export async function adoptPet(userId, { name, species }, now = Date.now()) {
  return withUserLock(userId, async () => {
    const row = await currentRow(userId);
    if (row?.alive) throw new GameError('You already have a pet to look after.', 409);
    const pet = newPet({ name, species, now });
    const cols = PET_COLS.join(', ');
    const marks = PET_COLS.map(() => '?').join(', ');
    const res = await query(
      `INSERT INTO pets (${cols}) VALUES (${marks})`,
      ...PET_COLS.map((c) => (c === 'user_id' ? userId : pet[c])),
    );
    await addEvents(res.lastID, [{ at: now, text: `${pet.name} the ${species} arrived as an egg.` }]);
    return toView({ ...pet, id: res.lastID }, now);
  });
}

export async function doAction(userId, action, params = {}, now = Date.now()) {
  if (!Object.hasOwn(actions, action)) throw new GameError('Unknown action.', 404);
  return withUserLock(userId, async () => {
    const row = await currentRow(userId);
    if (!row) throw new GameError('Adopt a pet first.', 404);
    const ticked = tick(row, now);
    let result;
    try {
      result = actions[action](ticked.pet, params);
    } catch (err) {
      if (err instanceof GameError) {
        // The elapsed time still counts even when the action is refused.
        await save(ticked.pet);
        await addEvents(row.id, ticked.events);
      }
      throw err;
    }
    await save(result.pet);
    const events = [...ticked.events];
    if (result.log) events.push({ at: now, text: result.log });
    await addEvents(row.id, events);
    return { pet: toView(result.pet, now), message: result.message, extra: result.extra ?? null };
  });
}

export async function recentEvents(userId, limit = 20) {
  const row = await currentRow(userId);
  if (!row) return [];
  return query('SELECT at, text FROM pet_events WHERE pet_id = ? ORDER BY at DESC, id DESC LIMIT ?', row.id, limit);
}

export async function memorial(userId) {
  const rows = await query(
    'SELECT * FROM pets WHERE user_id = ? AND alive = 0 ORDER BY died_at DESC LIMIT 20',
    userId,
  );
  return rows.map((r) => toView(r, r.died_at));
}

export async function leaderboard(now = Date.now(), limit = 10) {
  const rows = await query(
    `SELECT p.*, u.username FROM pets p JOIN users u ON u.id = p.user_id
     WHERE (CASE WHEN p.alive = 1 THEN ? ELSE p.died_at END) - p.born_at > ?
     ORDER BY (CASE WHEN p.alive = 1 THEN ? ELSE p.died_at END) - p.born_at DESC LIMIT ?`,
    now, EGG_MS, now, limit,
  );
  return rows.map((r) => {
    const v = toView(r, now);
    return { owner: r.username, name: v.name, species: v.species, stage: v.stage, form: v.form,
      alive: v.alive, ageMs: v.ageMs, ageDays: v.ageDays };
  });
}

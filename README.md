# Tamagotchi たまごっち

A web version of the Japanese virtual pet game. Sign up, adopt an egg, and keep your pet alive by feeding it, playing, cleaning up after it, giving medicine and putting it to bed. Accounts, pets and diaries are stored in [SQLite Cloud](https://sqlitecloud.io).

## Run it

```bash
npm install
cp .env.example .env     # then put your SQLITECLOUD_URL in .env
npm start                # landing page at http://localhost:3000, game at /play
npm test                 # game-rule unit tests (no database needed)
```

`SQLITECLOUD_URL` looks like `sqlitecloud://<host>.sqlite.cloud:8860/<database>?apikey=<key>`. The `.env` file is git-ignored; never commit the API key. Tables are created automatically on startup.

## How the game works

One pet "day" is one real hour. Time passes while you are away (up to 12 hours is simulated per visit), so check in regularly.

| Stage | Age |
| --- | --- |
| Egg | first minute (hatches by itself) |
| Baby | under 1 day |
| Child | 1-3 days |
| Teen | 3-7 days |
| Adult | 7+ days; the form (Angelic / Normal / Rascal) depends on your care mistakes |

Stats: fullness, happiness, energy, cleanliness, health. Actions:

- **Meal / Snack** - meals fill the tummy, snacks cheer it up but add weight (too heavy means no snacks).
- **Play** - guess which way your pet will look. Costs energy and fullness, and burns weight.
- **Cuddle** - a little happiness.
- **Clean / Bath** - remove mess and restore cleanliness. Leaving mess around makes your pet sick.
- **Medicine** - cures sickness.
- **Lights** - put the pet to sleep to regain energy.

If health reaches zero the pet passes away (starvation, illness or neglect) and moves to your memorial; you can then adopt a new egg. The hall of fame ranks the longest-lived pets.

## Code layout

- `src/engine.js` - pure simulation rules (tick, actions, evolution); unit tested in `test/`.
- `src/db.js` - SQLite Cloud connection and schema.
- `src/auth.js` - scrypt password hashing and cookie sessions (stored hashed in the DB).
- `src/pets.js` - persistence for pets, per-user locking, diary, leaderboard.
- `src/server.js` - Express API and static hosting.
- `public/index.html`, `landing.css`, `landing.js` - the marketing landing page with a try-it-out demo.
- `public/play.html`, `app.js`, `style.css` - the game itself, served at `/play`.
- `public/sprites.js` - SVG pets drawn in code, shared by both pages.

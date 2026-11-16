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

## Mobile app (PWA)

The game is designed phone-first and can be installed like a native app:

- **Android / Chrome / Edge**: an *Install* button appears in the app (and on the landing page); tap it to add Tamagotchi to your home screen.
- **iPhone / iPad (Safari)**: tap *Install* to see the steps (Share, then *Add to Home Screen*).
- Installed, it opens full screen with its own icon, works around notches (safe areas), and shows a friendly offline screen when there is no connection (game data always comes live from the server, so your pet is never out of sync).

Mobile UX details: bottom tab bar and thumb-reach action dock, bottom sheets for feeding/playing/washing, a speech bubble that says what the pet needs (with a one-tap shortcut), colour-coded stats, explanatory messages instead of dead disabled buttons, haptic feedback, reduced-motion support and 44px+ touch targets.

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
- **Talk** - open a chat with your pet. They reply in their own voice (love, jokes, how-are-you, Japanese greetings…) and their face shows more emotions: excited, shy, lonely, grumpy, proud, curious and more.

If health reaches zero the pet passes away (starvation, illness or neglect) and moves to your memorial; you can then adopt a new egg. The hall of fame ranks the longest-lived pets.

## Code layout

- `src/engine.js` - pure simulation rules (tick, actions, evolution, moods); unit tested in `test/`.
- `src/chat.js` - personality-driven chat replies (no external AI).
- `src/db.js` - SQLite Cloud connection and schema.
- `src/auth.js` - scrypt password hashing and cookie sessions (stored hashed in the DB).
- `src/pets.js` - persistence for pets, per-user locking, diary, leaderboard.
- `src/server.js` - Express API and static hosting.
- `public/index.html`, `landing.css`, `landing.js` - the marketing landing page with a try-it-out demo.
- `public/play.html`, `app.js`, `app.css`, `style.css`, `sheet.js` - the mobile-first game shell, served at `/play` (`sheet.js` is the bottom-sheet component).
- `public/manifest.webmanifest`, `sw.js`, `offline.html`, `pwa.js`, `icons/` - PWA manifest, service worker (app shell cache; API calls are never cached), offline page, install handling and app icons.
- `public/sprites.js` - flat SVG pets (Mochi, Neko, Usagi, Tori) drawn in code, shared by both pages.
- `public/pet3d.js` - the 3D pets (Neko, Inu, Panda, Kitsune, Penguin, Hamster, Axolotl), built from plush-style three.js shapes with expressive faces. Drag to spin 360°, tap to show an emotion. three.js is served from `node_modules` at `/vendor/three`; browsers without WebGL fall back to flat art.

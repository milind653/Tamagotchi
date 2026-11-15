import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { initSchema, closeDb } from './db.js';
import * as auth from './auth.js';
import * as pets from './pets.js';
import { GameError, SPECIES } from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'",
  });
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Cookies are SameSite=Lax; additionally require JSON bodies on writes so plain cross-site form posts are rejected.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }
  next();
});

const attempts = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const rec = attempts.get(key);
    if (!rec || rec.reset < now) attempts.set(key, { count: 1, reset: now + windowMs });
    else if (++rec.count > max) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
}, 60_000).unref();

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const requireUser = wrap(async (req, res, next) => {
  const user = await auth.userForToken(req.cookies[auth.COOKIE]);
  if (!user) return res.status(401).json({ error: 'Please log in.' });
  req.user = user;
  next();
});

async function startSession(req, res, user) {
  const { token, maxAge } = await auth.createSession(user.id);
  res.cookie(auth.COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge, path: '/' });
}

app.post('/api/auth/register', rateLimit(10, 10 * 60_000), wrap(async (req, res) => {
  const user = await auth.register(req.body?.username, req.body?.password);
  await startSession(req, res, user);
  res.status(201).json({ user: { username: user.username } });
}));

app.post('/api/auth/login', rateLimit(20, 10 * 60_000), wrap(async (req, res) => {
  const user = await auth.login(req.body?.username, req.body?.password);
  await startSession(req, res, user);
  res.json({ user: { username: user.username } });
}));

app.post('/api/auth/logout', wrap(async (req, res) => {
  await auth.destroySession(req.cookies[auth.COOKIE]);
  res.clearCookie(auth.COOKIE, { path: '/' });
  res.json({ ok: true });
}));

app.get('/api/me', requireUser, (req, res) => res.json({ user: { username: req.user.username } }));
app.get('/api/species', (req, res) => res.json({ species: SPECIES }));

app.get('/api/pet', requireUser, wrap(async (req, res) => {
  res.json({ pet: await pets.getCurrentPet(req.user.id), serverTime: Date.now() });
}));

app.post('/api/pet', requireUser, wrap(async (req, res) => {
  const pet = await pets.adoptPet(req.user.id, { name: req.body?.name, species: req.body?.species });
  res.status(201).json({ pet });
}));

app.post('/api/pet/:action', requireUser, wrap(async (req, res) => {
  const { action } = req.params;
  const params = action === 'feed' ? { kind: req.body?.kind } : action === 'play' ? { guess: req.body?.guess } : {};
  res.json(await pets.doAction(req.user.id, action, params));
}));

app.get('/api/events', requireUser, wrap(async (req, res) => {
  res.json({ events: await pets.recentEvents(req.user.id) });
}));

app.get('/api/memorial', requireUser, wrap(async (req, res) => {
  res.json({ pets: await pets.memorial(req.user.id) });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  res.json({ pets: await pets.leaderboard() });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build'), {
  index: false,
  setHeaders: (res) => res.set('Cache-Control', 'public, max-age=86400'),
}));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof GameError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Bad request body.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT) || 3000;
await initSchema();
const server = app.listen(port, () => console.log(`Tamagotchi running on http://localhost:${port}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => closeDb());
    setTimeout(() => process.exit(0), 1000).unref();
  });
}

// Personality-driven chat replies. No external LLM — responses depend on
// species, stage, form, current mood and what the human said.

const SPECIES_VOICE = {
  mochi: { soft: true, sound: 'pyon', quirks: ['*squish*', '*wobble*'] },
  neko: { soft: true, sound: 'nya', quirks: ['*purr*', '*kneads paws*'] },
  usagi: { soft: true, sound: 'pyon', quirks: ['*hop*', '*twitches ears*'] },
  tori: { soft: false, sound: 'piyo', quirks: ['*flap*', '*chirp*'] },
  panda: { soft: true, sound: 'munch', quirks: ['*rolls over*', '*hugs bamboo*'] },
  kitsune: { soft: false, sound: 'kon', quirks: ['*swishes tail*', '*fox smile*'] },
  penguin: { soft: true, sound: 'kyuu', quirks: ['*waddle*', '*flips wings*'] },
  hamster: { soft: true, sound: 'kyu', quirks: ['*stuff cheeks*', '*nibble*'] },
  axolotl: { soft: true, sound: 'blub', quirks: ['*wiggles gills*', '*float-dance*'] },
};

const INTENTS = [
  { id: 'love', re: /\b(love|luv|adore|miss|cute|daisuki|好き|大好き|aishiteru|hug|cuddle|kiss|pretty|beautiful|handsome)\b/i },
  { id: 'food', re: /\b(food|eat|hungry|meal|snack|rice|onigiri|treat|yum|ご飯|ごはん|たべ|お腹)\b/i },
  { id: 'play', re: /\b(play|game|fun|toy|bored|あそ|遊|playtime)\b/i },
  { id: 'sleep', re: /\b(sleep|night|bed|tired|oyasumi|おやすみ|zzz|rest|nap)\b/i },
  { id: 'hello', re: /\b(hi|hello|hey|yo|ohayo|おはよう|こんにちは|konnichiwa|good\s*(morning|afternoon|evening)|howdy)\b/i },
  { id: 'thanks', re: /\b(thanks|thank|arigatou|ありがとう|thx|ty)\b/i },
  { id: 'sorry', re: /\b(sorry|apolog|gomen|ごめん|forgive|my bad)\b/i },
  { id: 'praise', re: /\b(good\s*(boy|girl|pet|job)|best|smart|brave|proud|amazing|wonderful|great)\b/i },
  { id: 'scold', re: /\b(bad|stupid|dumb|hate|shut up|annoying|useless|ugly)\b/i },
  { id: 'how', re: /\b(how are you|how('re| are) you|feeling|okay\?|are you (ok|okay|alright)|元気|げんき)\b/i },
  { id: 'name', re: /\b(your name|who are you|what('s| is) your name|名前|namae)\b/i },
  { id: 'joke', re: /\b(joke|funny|laugh|make me laugh|pun)\b/i },
  { id: 'sing', re: /\b(sing|song|music|lullaby|うた|歌)\b/i },
];

function pick(list, seed = 0) {
  return list[Math.abs(seed) % list.length];
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function intentOf(text) {
  for (const row of INTENTS) if (row.re.test(text)) return row.id;
  if (/[?]/.test(text)) return 'how';
  return 'chat';
}

function babyTalk(text, voice) {
  const sound = voice.sound;
  return pick([
    `${sound}… ${sound}!`,
    `…${sound}?`,
    `${sound}${sound}! *wiggle*`,
    `Mmm… ${sound}!`,
  ], hash(text));
}

function wrapQuirk(line, voice, seed) {
  if (Math.abs(seed) % 3 !== 0) return line;
  return `${line} ${pick(voice.quirks, seed)}`;
}

function statusLine(p) {
  if (p.sick) return `I feel yucky… medicine please?`;
  if (p.hunger < 30) return `My tummy is rumbling… food?`;
  if (p.poop > 0) return `It's a bit messy in here…`;
  if (p.happiness < 30) return `I feel a little lonely.`;
  if (p.energy < 25) return `I'm so sleepy…`;
  if (p.happiness > 80) return `I'm sparkling happy today!`;
  return `I'm doing alright — thanks for asking!`;
}

function buildReply(p, text, intent) {
  const voice = SPECIES_VOICE[p.species] ?? SPECIES_VOICE.mochi;
  const seed = hash(text + String(p.id ?? p.name) + String(Math.floor(Date.now() / 30_000)));
  const name = p.name;
  const soft = voice.soft || p.stage === 'baby' || p.stage === 'child';

  if (p.stage === 'egg') {
    return { reply: '… *tap tap* …something wiggles inside the egg.', emotion: 'curious' };
  }
  if (!p.alive) {
    return { reply: `…a soft breeze. ${name} can't answer anymore.`, emotion: 'sad' };
  }
  if (p.sleeping) {
    return {
      reply: pick([
        `Zzz… ${name}… mumble… love you… zzz`,
        `*twitches in sleep* …food dreams… zzz`,
        `Mmm… don't go… zzz`,
      ], seed),
      emotion: 'sleepy',
    };
  }
  if (p.stage === 'baby' && !['love', 'food', 'scold', 'sorry', 'praise', 'how'].includes(intent)) {
    return { reply: babyTalk(text, voice), emotion: pick(['curious', 'shy', 'happy', 'love'], seed) };
  }

  if (p.sick && intent !== 'sorry' && intent !== 'love') {
    return { reply: wrapQuirk(`Uugh… ${name} feels sick. Can I have medicine?`, voice, seed), emotion: 'sick' };
  }
  if (p.hunger < 25 && (intent === 'chat' || intent === 'how' || intent === 'hello')) {
    return { reply: wrapQuirk(`I'm starving… feed me and then we can chat more!`, voice, seed), emotion: 'hungry' };
  }

  switch (intent) {
    case 'love':
      return {
        reply: wrapQuirk(pick([
          soft ? `Hehe… I love you too! 💗` : `Hmph… I guess I love you too.`,
          `${name} loves you the most!`,
          `Daisuki! You're my favourite human.`,
          `*nuzzles* That made my heart warm.`,
        ], seed), voice, seed),
        emotion: 'love',
        joy: 8,
      };
    case 'food':
      return {
        reply: p.hunger < 55
          ? wrapQuirk(`Yes please! My tummy says yum-yum time.`, voice, seed)
          : wrapQuirk(`I'm pretty full… but a tiny snack never hurts.`, voice, seed),
        emotion: p.hunger < 55 ? 'hungry' : 'happy',
        joy: 2,
      };
    case 'play':
      return {
        reply: p.energy < 20
          ? `I'm too tired to play… lights off?`
          : wrapQuirk(pick([`Yay! Let's play the looking game!`, `Play play play! Guess which way I look!`, `Hehe, I bet you can't catch me.`], seed), voice, seed),
        emotion: p.energy < 20 ? 'tired' : 'excited',
        joy: 3,
      };
    case 'sleep':
      return {
        reply: p.energy < 50
          ? wrapQuirk(`Oyasumi… turn the lights off for me?`, voice, seed)
          : wrapQuirk(`I'm not that sleepy yet! One more adventure?`, voice, seed),
        emotion: p.energy < 50 ? 'tired' : 'curious',
        joy: 2,
      };
    case 'hello':
      return {
        reply: wrapQuirk(pick([
          `Hi hi! I missed you!`,
          `Ohayo! ${name} is ready for today.`,
          `You're back! ${voice.sound}!`,
          soft ? `Hello, best friend.` : `Yo. Took you long enough.`,
        ], seed), voice, seed),
        emotion: 'excited',
        joy: 5,
      };
    case 'thanks':
      return {
        reply: wrapQuirk(pick([`Anytime!`, `Hehe, you're welcome.`, `Arigatou to you too!`], seed), voice, seed),
        emotion: 'happy',
        joy: 3,
      };
    case 'sorry':
      return {
        reply: wrapQuirk(pick([
          `It's okay… I forgive you.`,
          `*sniff* Come give me a hug and we're even.`,
          `Don't worry. ${name} still likes you.`,
        ], seed), voice, seed),
        emotion: 'shy',
        joy: 4,
      };
    case 'praise':
      return {
        reply: wrapQuirk(pick([
          `Really?! *beams* I'm so proud!`,
          `Yay! Tell me again!`,
          soft ? `Hehe… that makes me shy.` : `Obviously. I'm amazing.`,
        ], seed), voice, seed),
        emotion: soft && seed % 2 ? 'shy' : 'proud',
        joy: 7,
      };
    case 'scold':
      return {
        reply: pick([
          `That hurt… 💧`,
          `*ears droop* Why would you say that?`,
          `…I'll try to be better.`,
        ], seed),
        emotion: 'sad',
        joy: -6,
      };
    case 'how':
      return { reply: wrapQuirk(statusLine(p), voice, seed), emotion: moodHint(p), joy: 2 };
    case 'name':
      return {
        reply: wrapQuirk(`I'm ${name} the ${p.species}! Nice to meet you again.`, voice, seed),
        emotion: 'happy',
        joy: 2,
      };
    case 'joke':
      return {
        reply: wrapQuirk(pick([
          `Why did the egg blush? Because it saw the salad dressing!`,
          `What do pets write with? A *pen*-guin!`,
          `I tried to tell a joke about food… but I ate the punchline.`,
          `${voice.sound}… wait, that was the joke.`,
        ], seed), voice, seed),
        emotion: 'excited',
        joy: 5,
      };
    case 'sing':
      return {
        reply: wrapQuirk(pick([
          `♪ La la ${name}~ la la love you~ ♪`,
          `♪ ${voice.sound} ${voice.sound} pyon pyon~ ♪`,
          `♪ Tiny pet, big heart, never ever apart~ ♪`,
        ], seed), voice, seed),
        emotion: 'love',
        joy: 6,
      };
    default:
      return {
        reply: wrapQuirk(pick([
          soft ? `Hmm… tell me more!` : `Interesting. Go on.`,
          `I like talking with you.`,
          `${voice.sound}? I think I understood… maybe?`,
          `That sounds important. *nods wisely*`,
          p.form === 'rascal' ? `Heh. You're weird. I like weird.` : `You're the nicest human.`,
          p.happiness < 40 ? `Stay a bit longer? I get lonely.` : `Want to cuddle after this?`,
        ], seed), voice, seed),
        emotion: p.happiness < 40 ? 'lonely' : 'curious',
        joy: 3,
      };
  }
}

function moodHint(p) {
  if (p.sick) return 'sick';
  if (p.hunger < 25) return 'hungry';
  if (p.energy < 25) return 'tired';
  if (p.happiness < 30) return 'lonely';
  if (p.happiness > 80) return 'excited';
  return 'happy';
}

/** @param {object} p pet row
 *  @param {string} clean already-trimmed message (1-140 chars) */
export function chatWithPet(p, clean) {
  const intent = intentOf(clean);
  const { reply, emotion, joy = 2 } = buildReply(p, clean, intent);

  // Eggs and departed pets can "reply" softly without changing stats.
  if (p.alive && p.stage !== 'egg' && !p.sleeping) {
    p.happiness = Math.min(100, Math.max(0, p.happiness + joy));
  }

  const snippet = clean.length > 40 ? `${clean.slice(0, 37)}…` : clean;
  return {
    pet: p,
    message: reply,
    log: `You told ${p.name}: “${snippet}” → ${reply}`,
    extra: { you: clean, reply, emotion, intent },
  };
}

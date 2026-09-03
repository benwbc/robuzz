// Wipes the database and fills it with a realistic demo community:
// staff/official/creator/verified accounts, a suspended and a banned
// account, a following graph, posts (text + image), comments, likes, a
// repost, and a few reports (including one already resolved) so the
// moderation dashboard has real content the first time you open it.
//
// Run with: npm run seed   (from the server/ folder)
//
// WARNING: this deletes all existing data first. Only run it against a
// live/production database (DATABASE_URL set to it) once, right after
// setting it up — running it again later would erase any real accounts
// and posts that have been created since.

import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db, initDb } from './db.js';
import { fileUrl, usingCloudStorage } from './utils/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedAssetsDir = path.join(__dirname, '..', 'seed-assets');
const uploadsPostsDir = path.join(__dirname, '..', 'uploads', 'posts');

console.log(`Setting up the database${db.isPostgres ? ' (Postgres)' : ' (local SQLite)'}...`);
await initDb();

console.log('Wiping existing data...');
await db.exec(`
  DELETE FROM audit_log;
  DELETE FROM reports;
  DELETE FROM notifications;
  DELETE FROM comments;
  DELETE FROM likes;
  DELETE FROM follows;
  DELETE FROM posts;
  DELETE FROM users;
`);

// ---- get placeholder post images somewhere they can be served from, the
// same way any real user upload would be: local disk in dev, or Supabase
// Storage in production (wherever SUPABASE_URL/SUPABASE_SERVICE_KEY point) ----
const IMAGES = {};
if (usingCloudStorage) {
  console.log('Uploading seed images to Supabase Storage...');
  for (const file of fs.readdirSync(seedAssetsDir)) {
    const buffer = fs.readFileSync(path.join(seedAssetsDir, file));
    const ext = path.extname(file).toLowerCase();
    const mimetype = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    IMAGES[file] = await fileUrl({ buffer, originalname: file, mimetype }, 'posts');
  }
} else {
  fs.mkdirSync(uploadsPostsDir, { recursive: true });
  for (const file of fs.readdirSync(seedAssetsDir)) {
    const dest = path.join(uploadsPostsDir, `seed-${file}`);
    fs.copyFileSync(path.join(seedAssetsDir, file), dest);
    IMAGES[file] = `/uploads/posts/seed-${file}`;
  }
}

const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

const AVATAR_COLORS = ['#E2231A', '#0074E4', '#00BA7C', '#F2B90C', '#8B5CF6', '#FF6B00'];
function colorFor(i) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

async function insertUser(u) {
  await db.run(
    `INSERT INTO users (id, username, display_name, email, password_hash, bio, avatar_color, badge, role, status, suspended_until, status_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      u.id,
      u.username,
      u.display_name,
      u.email,
      u.password_hash,
      u.bio,
      u.avatar_color,
      u.badge,
      u.role,
      u.status,
      u.suspended_until,
      u.status_reason,
      u.created_at,
    ]
  );
}

const USERS = [
  {
    key: 'ben',
    username: 'ben',
    display_name: 'Ben',
    email: 'ben@blockfeed.local',
    password: 'admin1234',
    bio: 'Running the place. Ping me if something is broken. 🛠️',
    badge: 'staff',
    role: 'admin',
    status: 'active',
    created_at: daysAgo(40),
  },
  {
    key: 'modmax',
    username: 'modmax',
    display_name: 'Max',
    email: 'modmax@blockfeed.local',
    password: 'password123',
    bio: 'Trust & safety team. Reports get read here first.',
    badge: 'staff',
    role: 'moderator',
    status: 'active',
    created_at: daysAgo(35),
  },
  {
    key: 'pixelforge',
    username: 'pixelforge_studios',
    display_name: 'PixelForge Studios',
    email: 'hello@pixelforge.example',
    password: 'password123',
    bio: 'We make Skyway Dash 🏁 and Obby Nation. Official studio account.',
    badge: 'official',
    role: 'user',
    status: 'active',
    created_at: daysAgo(60),
  },
  {
    key: 'blockbuildertv',
    username: 'blockbuildertv',
    display_name: 'BlockBuilderTV',
    email: 'blockbuildertv@example.com',
    password: 'password123',
    bio: 'Builds, speedruns & tier lists every week 🎥🔴',
    badge: 'content_creator',
    role: 'user',
    status: 'active',
    created_at: daysAgo(50),
  },
  {
    key: 'jamie',
    username: 'jamie_verified',
    display_name: 'Jamie',
    email: 'jamie@example.com',
    password: 'password123',
    bio: 'Verified BlockFeed member since the beta.',
    badge: 'verified',
    role: 'user',
    status: 'active',
    created_at: daysAgo(45),
  },
  {
    key: 'alex',
    username: 'alexbuilds',
    display_name: 'Alex',
    email: 'alex@example.com',
    password: 'password123',
    bio: 'obby enjoyer. building a tycoon game rn',
    badge: 'none',
    role: 'user',
    status: 'active',
    created_at: daysAgo(30),
  },
  {
    key: 'mia',
    username: 'mia_plays',
    display_name: 'Mia',
    email: 'mia@example.com',
    password: 'password123',
    bio: 'adopt me but its literally a different game i swear',
    badge: 'none',
    role: 'user',
    status: 'active',
    created_at: daysAgo(28),
  },
  {
    key: 'noob',
    username: 'noobmaster99',
    display_name: 'noobmaster99',
    email: 'noobmaster99@example.com',
    password: 'password123',
    bio: 'pvp main. dm for 1v1',
    badge: 'none',
    role: 'user',
    status: 'active',
    created_at: daysAgo(20),
  },
  {
    key: 'scriptkid',
    username: 'scriptkid_dev',
    display_name: 'ScriptKid',
    email: 'scriptkid@example.com',
    password: 'password123',
    bio: 'learning Luau, breaking my own game daily',
    badge: 'none',
    role: 'user',
    status: 'active',
    created_at: daysAgo(15),
  },
  {
    key: 'shady',
    username: 'shadyseller',
    display_name: 'Robux Deals 4U',
    email: 'shadyseller@example.com',
    password: 'password123',
    bio: 'DM for the BEST robux deals ever!!',
    badge: 'none',
    role: 'user',
    status: 'suspended',
    suspended_until: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status_reason: 'Repeatedly advertising a Robux scam link.',
    created_at: daysAgo(10),
  },
  {
    key: 'spambot',
    username: 'spambot_42',
    display_name: 'FreeRobux_Official',
    email: 'spambot42@example.com',
    password: 'password123',
    bio: 'click my link for free robux!!!',
    badge: 'none',
    role: 'user',
    status: 'banned',
    status_reason: 'Confirmed scam / phishing bot.',
    created_at: daysAgo(5),
  },
];

const ids = {};
for (const [i, u] of USERS.entries()) {
  const id = randomUUID();
  ids[u.key] = id;
  await insertUser({
    id,
    username: u.username,
    display_name: u.display_name,
    email: u.email,
    password_hash: hash(u.password),
    bio: u.bio,
    avatar_color: colorFor(i),
    badge: u.badge,
    role: u.role,
    status: u.status,
    suspended_until: u.suspended_until || null,
    status_reason: u.status_reason || null,
    created_at: u.created_at,
  });
}

// ---- follow graph ----
async function follow(followerId, followingId, createdAt) {
  try {
    await db.run('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)', [
      followerId,
      followingId,
      createdAt,
    ]);
  } catch {
    // Already following — the seed data below has a couple of pairs that
    // overlap between the "everyone follows the hub accounts" loop and the
    // explicit friend list. Fine to just skip the duplicate.
  }
}

const everyone = USERS.map((u) => u.key).filter((k) => !['shady', 'spambot'].includes(k));
for (const key of everyone) {
  // everyone follows the two "hub" accounts
  if (key !== 'pixelforge') await follow(ids[key], ids.pixelforge, daysAgo(20));
  if (key !== 'blockbuildertv') await follow(ids[key], ids.blockbuildertv, daysAgo(18));
}
// a friend web among the regular users
const pairs = [
  ['alex', 'mia'], ['mia', 'alex'], ['alex', 'noob'], ['mia', 'scriptkid'],
  ['noob', 'jamie'], ['scriptkid', 'alex'], ['jamie', 'alex'],
  ['ben', 'modmax'], ['modmax', 'ben'], ['jamie', 'blockbuildertv'],
];
for (const [a, b] of pairs) {
  if (ids[a] && ids[b]) await follow(ids[a], ids[b], daysAgo(12));
}

// ---- posts ----
async function insertPost(p) {
  await db.run(
    `INSERT INTO posts (id, author_id, text, images, repost_of, created_at, deleted, flagged, flag_reason)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [p.id, p.author_id, p.text, p.images, p.repost_of, p.created_at, p.flagged, p.flag_reason]
  );
}

async function makePost({ author, text, images = [], createdAt, flagged = 0, flagReason = null, repostOf = null }) {
  const id = randomUUID();
  await insertPost({
    id,
    author_id: ids[author],
    text,
    images: JSON.stringify(images),
    repost_of: repostOf,
    created_at: createdAt,
    flagged,
    flag_reason: flagReason,
  });
  return id;
}

const pOfficialLaunch = await makePost({
  author: 'pixelforge',
  text: 'Skyway Dash Season 4 is live! New tracks, new hats, and a big #obby update. Go check it out 🏁',
  images: [IMAGES['update-shot.png']],
  createdAt: daysAgo(3),
});

await makePost({
  author: 'pixelforge',
  text: 'PSA: we will never DM you asking for your password or offering "free robux" for testing our game. Please report anyone doing that.',
  createdAt: daysAgo(2),
});

const pCreatorBuild = await makePost({
  author: 'blockbuildertv',
  text: 'Spent 14 hours on this tycoon base for the next video 😭 worth it though. #tycoon #build',
  images: [IMAGES['tycoon-build.png']],
  createdAt: daysAgo(2),
});

await makePost({
  author: 'blockbuildertv',
  text: 'New video tomorrow: ranking every obby map from worst to best. @alexbuilds your map is in it 👀',
  createdAt: hoursAgo(20),
});

await makePost({
  author: 'jamie',
  text: 'finally beat the hardest obby on the platform after like 200 deaths 💀',
  images: [IMAGES['obby-run.png']],
  createdAt: daysAgo(1),
});

const pAlexArena = await makePost({
  author: 'alex',
  text: 'made a new pvp arena map, thoughts? @noobmaster99 you have to try this one',
  images: [IMAGES['pvp-arena.png']],
  createdAt: hoursAgo(30),
});

await makePost({
  author: 'mia',
  text: 'new skin just dropped and its actually so cute??',
  images: [IMAGES['new-skin.png']],
  createdAt: hoursAgo(26),
});

await makePost({
  author: 'noob',
  text: 'gg to whoever i just played, that was actually a real 1v1',
  createdAt: hoursAgo(15),
});

await makePost({
  author: 'scriptkid',
  text: "finally fixed the bug that was duplicating every player's inventory. Luau is undefeated at humbling me",
  createdAt: hoursAgo(10),
});

await makePost({
  author: 'alex',
  text: 'wr attempt going well so far, wish me luck 🍀',
  images: [IMAGES['speedrun.png']],
  createdAt: hoursAgo(6),
});

await makePost({
  author: 'mia',
  text: 'drew some fanart of my favorite avatar look, might turn it into a shirt',
  images: [IMAGES['fan-art.png']],
  createdAt: hoursAgo(4),
});

// A rule-breaking post from the (already banned) spam account — this is
// what an automated filter catching real content looks like.
const pScam = await makePost({
  author: 'spambot',
  text: 'FREE ROBUX GENERATOR!! no human verification, click the link in my bio before it gets taken down!!',
  createdAt: daysAgo(6),
  flagged: 1,
  flagReason: 'Possible Robux scam ("free robux")',
});

// A post from the suspended account — left visible on their own profile,
// but excluded from the main/explore feeds by the suspended-author check.
const pShady = await makePost({
  author: 'shady',
  text: 'best robux deals guaranteed, message me before i sell out!!',
  createdAt: daysAgo(9),
});

// ---- a repost ----
const repostId = await makePost({ author: 'jamie', text: '', repostOf: pOfficialLaunch, createdAt: daysAgo(2) });
void repostId;

// ---- likes ----
async function like(userId, postId, createdAt) {
  try {
    await db.run('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)', [userId, postId, createdAt]);
  } catch {
    // duplicate like — fine to skip
  }
}
const likeCombos = [
  ['alex', pOfficialLaunch], ['mia', pOfficialLaunch], ['noob', pOfficialLaunch], ['jamie', pOfficialLaunch],
  ['scriptkid', pCreatorBuild], ['mia', pCreatorBuild], ['ben', pCreatorBuild],
  ['mia', pAlexArena], ['noob', pAlexArena], ['blockbuildertv', pAlexArena],
];
for (const [who, post] of likeCombos) await like(ids[who], post, hoursAgo(2));

// ---- comments ----
async function comment(author, postId, text, createdAt) {
  await db.run(`INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    postId,
    ids[author],
    text,
    createdAt,
  ]);
}
await comment('alex', pOfficialLaunch, 'the new hats go so hard ngl', hoursAgo(60));
await comment('mia', pOfficialLaunch, 'FINALLY a proper obby update', hoursAgo(55));
await comment('jamie', pCreatorBuild, 'this is insane, how long did the roof take', hoursAgo(40));
await comment('blockbuildertv', pCreatorBuild, '@jamie_verified like 4 hours alone lol', hoursAgo(39));
await comment('noob', pAlexArena, 'the spawn points need work but otherwise solid', hoursAgo(20));

// ---- notifications (a few, so the bell has something to show) ----
async function insertNotif(id, userId, type, actorId, postId, message, read, createdAt) {
  await db.run(
    `INSERT INTO notifications (id, user_id, type, actor_id, post_id, message, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, type, actorId, postId, message, read, createdAt]
  );
}
await insertNotif(randomUUID(), ids.alex, 'like', ids.mia, pAlexArena, '@mia_plays liked your post.', 0, hoursAgo(20));
await insertNotif(randomUUID(), ids.alex, 'comment', ids.noob, pAlexArena, '@noobmaster99 commented on your post.', 0, hoursAgo(20));
await insertNotif(randomUUID(), ids.jamie, 'mention', ids.blockbuildertv, pCreatorBuild, '@blockbuildertv mentioned you.', 1, hoursAgo(39));

// ---- reports ----
async function insertReport(r) {
  await db.run(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, resolved_by, resolution_note, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id,
      r.reporter_id,
      r.target_type,
      r.target_id,
      r.reason,
      r.details,
      r.status,
      r.resolved_by,
      r.resolution_note,
      r.created_at,
      r.resolved_at,
    ]
  );
}

// 1) auto-flagged scam post -> still pending
await insertReport({
  id: randomUUID(),
  reporter_id: null,
  target_type: 'post',
  target_id: pScam,
  reason: 'auto-flagged',
  details: 'Possible Robux scam ("free robux")',
  status: 'pending',
  resolved_by: null,
  resolution_note: null,
  created_at: daysAgo(6),
  resolved_at: null,
});

// 2) a user report against the suspended seller's post -> still pending
await insertReport({
  id: randomUUID(),
  reporter_id: ids.alex,
  target_type: 'post',
  target_id: pShady,
  reason: 'scam',
  details: 'Pretty sure this is a robux scam account',
  status: 'pending',
  resolved_by: null,
  resolution_note: null,
  created_at: daysAgo(9),
  resolved_at: null,
});

// 3) an already-resolved historical report, for the audit log / history view
const resolvedReportId = randomUUID();
await insertReport({
  id: resolvedReportId,
  reporter_id: ids.mia,
  target_type: 'user',
  target_id: ids.noob,
  reason: 'harassment',
  details: 'Was pretty rude in my comments a couple weeks ago',
  status: 'actioned',
  resolved_by: ids.modmax,
  resolution_note: 'First offense — sent a warning.',
  created_at: daysAgo(14),
  resolved_at: daysAgo(13),
});
await db.run(
  `INSERT INTO audit_log (id, moderator_id, action, target_type, target_id, reason, created_at)
   VALUES (?, ?, 'warn_user', 'user', ?, ?, ?)`,
  [randomUUID(), ids.modmax, ids.noob, 'First offense — sent a warning.', daysAgo(13)]
);

console.log('\nSeed complete! Demo accounts (all passwords shown are for local testing only):\n');
console.table(
  USERS.map((u) => ({
    username: u.username,
    password: u.password,
    role: u.role,
    badge: u.badge,
    status: u.status,
  }))
);
console.log('Log in as "ben" for the full admin dashboard, or "modmax" for the moderator view.\n');

await db.close();

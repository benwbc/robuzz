import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { toPrivateUser } from '../utils/serialize.js';
import { promoteIfBootstrapAdmin } from '../utils/adminBootstrap.js';
import { normalizeOrigin } from '../utils/normalize.js';
import { fileUrl } from '../utils/upload.js';
import {
  discordConfigured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchDiscordUser,
  discordAvatarUrl,
} from '../utils/discord.js';

const router = Router();

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = ['#E2231A', '#0074E4', '#00BA7C', '#F2B90C', '#8B5CF6', '#FF6B00'];
const CLIENT_ORIGIN = normalizeOrigin(process.env.CLIENT_ORIGIN) || 'http://localhost:5173';

router.post('/signup', async (req, res) => {
  const { username, displayName, email, password } = req.body || {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscore.' });
  }
  if (!displayName || !displayName.trim() || displayName.length > 40) {
    return res.status(400).json({ error: 'Display name is required (max 40 characters).' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [
    username.toLowerCase(),
    email.toLowerCase(),
  ]);
  if (existing) {
    return res.status(409).json({ error: 'That username or email is already taken.' });
  }

  const id = randomUUID();
  const usernameLower = username.toLowerCase();
  const displayNameTrimmed = displayName.trim();
  const emailLower = email.toLowerCase();
  const passwordHash = bcrypt.hashSync(password, 10);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const createdAt = new Date().toISOString();

  await db.run(
    `INSERT INTO users (id, username, display_name, email, password_hash, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, usernameLower, displayNameTrimmed, emailLower, passwordHash, avatarColor, createdAt]
  );
  await promoteIfBootstrapAdmin(db, { id, email: emailLower });

  const full = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  const token = signToken(full);
  res.status(201).json({ token, user: toPrivateUser(full) });
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const row = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [
    identifier.toLowerCase(),
    identifier.toLowerCase(),
  ]);

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username/email or password.' });
  }

  if (row.status === 'banned') {
    return res
      .status(403)
      .json({ error: 'This account has been banned.', reason: row.status_reason || null, status: 'banned' });
  }

  if (row.status === 'suspended') {
    const until = row.suspended_until ? new Date(row.suspended_until) : null;
    if (until && until.getTime() <= Date.now()) {
      await db.run("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?", [row.id]);
      row.status = 'active';
      row.suspended_until = null;
    } else {
      return res.status(403).json({
        error: 'This account is temporarily suspended.',
        reason: row.status_reason || null,
        suspendedUntil: row.suspended_until || null,
        status: 'suspended',
      });
    }
  }

  const token = signToken(row);
  res.json({ token, user: toPrivateUser(row) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPrivateUser(req.user) });
});

function usernameFromDiscord(discordUsername) {
  let base = String(discordUsername || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base = (base + 'user').slice(0, 3).padEnd(3, '0');
  base = base.slice(0, 16); // leave room for a collision suffix up to 4 digits
  return base;
}

async function uniqueUsernameFromDiscord(discordUsername) {
  const base = usernameFromDiscord(discordUsername);
  let candidate = base;
  for (let i = 0; i < 8; i++) {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [candidate]);
    if (!existing) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 20);
  }
  return `user${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// Step 1 of the OAuth flow: send the browser to Discord's own consent
// screen. `state` is a nonce the client generated itself (see
// AuthContext/OAuthCallback) — it just rides along through the redirect
// chain unchanged so the client can verify, when it gets control back, that
// the response corresponds to the request it made.
router.get('/discord', (req, res) => {
  if (!discordConfigured) {
    return res.redirect(`${CLIENT_ORIGIN}/oauth/discord?error=${encodeURIComponent("Discord sign-in isn't set up on this server yet.")}`);
  }
  const state = typeof req.query.state === 'string' ? req.query.state.slice(0, 128) : '';
  res.redirect(buildAuthorizeUrl(state));
});

// Step 2: Discord sends the browser back here with a one-time code (or an
// error if the person cancelled). Exchange it for the person's Discord
// identity, find-or-create the matching RoBuzz account, and hand the
// browser an app token the same way login/signup do — just via a redirect
// with the token in the query string instead of a JSON body, since this
// request comes straight from Discord, not from our own client code.
router.get('/discord/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const fail = (message) =>
    res.redirect(`${CLIENT_ORIGIN}/oauth/discord?error=${encodeURIComponent(message)}&state=${encodeURIComponent(state)}`);

  if (req.query.error) {
    return fail('Discord sign-in was cancelled.');
  }
  if (!discordConfigured) {
    return fail("Discord sign-in isn't set up on this server yet.");
  }
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    return fail('Discord did not send back a valid sign-in code.');
  }

  let discordUser;
  try {
    const accessToken = await exchangeCodeForToken(code);
    discordUser = await fetchDiscordUser(accessToken);
  } catch (err) {
    console.error('Discord OAuth exchange failed:', err);
    return fail(err.message || "Couldn't complete Discord sign-in. Try again.");
  }

  try {
    // Returning user: we've seen this Discord account before.
    let user = await db.get('SELECT * FROM users WHERE discord_id = ?', [String(discordUser.id)]);

    // Not seen before, but Discord vouches for an email that matches an
    // existing password-based account — link them. Only trust this when
    // Discord itself reports the email as verified, since an unverified
    // email is just a claim anyone could type in.
    if (!user && discordUser.email && discordUser.verified) {
      user = await db.get('SELECT * FROM users WHERE email = ?', [String(discordUser.email).toLowerCase()]);
      if (user) {
        await db.run('UPDATE users SET discord_id = ?, discord_username = ? WHERE id = ?', [
          String(discordUser.id),
          discordUser.username,
          user.id,
        ]);
        user = await db.get('SELECT * FROM users WHERE id = ?', [user.id]);
      }
    }

    // Brand new person — create an account. It gets a random, permanently
    // unguessable password hash (has_password = 0 marks it as unset) rather
    // than a null column, so every other password check in the codebase
    // keeps working unchanged.
    if (!user) {
      const id = randomUUID();
      const username = await uniqueUsernameFromDiscord(discordUser.username);
      const displayName = (discordUser.global_name || discordUser.username || username).slice(0, 40);
      const email =
        discordUser.email && discordUser.verified
          ? String(discordUser.email).toLowerCase()
          : `discord-${discordUser.id}@users.robuzz.local`;
      const passwordHash = bcrypt.hashSync(randomUUID() + randomUUID(), 10);
      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const createdAt = new Date().toISOString();

      await db.run(
        `INSERT INTO users
           (id, username, display_name, email, password_hash, has_password, avatar_color,
            discord_id, discord_username, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [id, username, displayName, email, passwordHash, avatarColor, String(discordUser.id), discordUser.username, createdAt]
      );
      await promoteIfBootstrapAdmin(db, { id, email });

      const avatarSrc = discordAvatarUrl(discordUser);
      if (avatarSrc) {
        try {
          const imgRes = await fetch(avatarSrc);
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const url = await fileUrl({ buffer }, 'avatar');
            await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [url, id]);
          }
        } catch (err) {
          console.error("Couldn't import Discord avatar (non-fatal):", err);
        }
      }

      user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    if (user.status === 'banned') {
      return fail('This account has been banned.');
    }
    if (user.status === 'suspended') {
      const until = user.suspended_until ? new Date(user.suspended_until) : null;
      if (until && until.getTime() <= Date.now()) {
        await db.run("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?", [user.id]);
      } else {
        return fail('This account is temporarily suspended.');
      }
    }

    const token = signToken(user);
    res.redirect(`${CLIENT_ORIGIN}/oauth/discord?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`);
  } catch (err) {
    console.error('Discord sign-in failed:', err);
    return fail('Something went wrong finishing Discord sign-in.');
  }
});

export default router;

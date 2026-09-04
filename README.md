# RoBuzz

RoBuzz is a full-stack social platform for the Roblox community — a mashup of X (Twitter) and Instagram, with a
real moderation system underneath. It's a fan-made, independent project and is **not affiliated with or endorsed by
Roblox Corporation**.

Short text posts (with @mention autocomplete), up to 4 images per post with a full-screen lightbox viewer, likes,
comments, reposts, follows, an Instagram-style Explore grid, notifications, search, a user-facing support ticket
system, an in-feed advertisement system, a Terms of Service / Community Rules page, and one-click sign-up/sign-in
with Discord — plus four verified-style badges and a working staff moderation dashboard (reports queue,
auto-flagging, suspensions/bans, full account editing, an audit log, and role-based permissions). Uploaded images
are automatically resized and compressed on the server, and the feed is built to load in a small, fixed number of
database queries no matter how many posts are on the page.

Everything runs locally with no paid services, no API keys, and no external database — it's a real working app you
can run with two commands. It can also be deployed to a real `https://` URL for free — see
[Deploying it live](#deploying-it-live-free) below.

## Badges

| Badge | Color | Meaning |
|---|---|---|
| Verified | 🔵 Blue | Verified account |
| Staff | 🟢 Green | RoBuzz staff member |
| Official | 🟡 Yellow | Official account — a game studio, or Roblox staff |
| Content Creator | 🔴 Red | Content creator |

Badges are purely a display flag, separate from a user's internal permission level (`user` / `moderator` / `admin`).
That means an account can hold the Official badge for show without having any moderation power, and a moderator
doesn't need any particular badge to do their job. Only admins can grant the Staff and Official badges or change
someone's role; moderators can grant Verified/Content Creator and action reports (warn, suspend, ban, remove
content).

## Moderation system

- **Reporting** — any signed-in user can report a post, comment, or profile (spam, harassment, inappropriate
  content, impersonation, scam, other).
- **Automated flagging** — new posts and comments are scanned against a small keyword filter (Robux-scam links,
  phishing, etc.) and auto-flagged posts generate a system report in the same queue, attributed to "automated
  system." Extend the list in `server/src/utils/contentFilter.js`.
- **Moderator/admin dashboard** (`/admin`, staff-only) — an Overview with live stats, a Reports queue you can filter
  by status and resolve with one of: dismiss, remove the post/comment, warn, suspend (for N days), ban, or restore —
  a Users table to search accounts and change role/badge/status directly, a Support queue (see below), and an Audit
  Log of every action taken.
- **Full account editing** — from the Users table, staff can edit another account's display name, username, bio,
  avatar and banner (upload a replacement **or remove it entirely**, e.g. to take down an inappropriate profile
  picture), and reset their password (a one-time password is generated and shown once, to hand to the user). One
  restriction is built in: a moderator can freely edit any regular account this way, but editing another **staff**
  member's (moderator/admin) account details requires being an admin, or being that account's own owner — this
  stops a moderator from quietly taking over another moderator's or an admin's account. Role changes and the
  Staff/Official badges remain admin-only, unchanged from before.
- **Enforcement is real** — a suspended or banned account is blocked from logging in (with the reason and, for
  suspensions, the return date shown), and can't post, like, comment, follow, or report while active. Suspensions
  lift automatically once they expire.

## Support tickets

Any signed-in user can open a support ticket (**Support** in the sidebar) with a subject and message, and reply to
build up a conversation. Staff see every ticket in the Moderation dashboard's **Support** tab, filterable by open/
resolved, and can reply or mark a ticket resolved. If the user replies again later, the ticket automatically reopens
so it doesn't get lost. The Overview page surfaces a banner whenever tickets are waiting, the same way it does for
pending reports.

## Advertisements

An admin-only **Ads** tab in the Moderation dashboard (`/admin/ads`) lets you upload an image, an optional short
caption, and an optional link. Active ads are shown interleaved into the Home feed — one sponsored slot after every
5 organic posts, cycling through whichever ads are currently active — styled like a normal post but always labeled
**Sponsored** so it's clearly disclosed. Clicking one opens its link in a new tab. Moderators can see the Ads tab
(so they can keep an eye on how things are doing) but only an admin can add, pause/resume, or delete an ad — this
is real advertiser content, not routine moderation. Each ad tracks how many times it's been shown and clicked,
shown right in the list.

To take an ad down without losing its stats, use **Pause** rather than **Delete** — a paused ad disappears from the
feed immediately but stays in the list so you can **Resume** it later. **Delete** is permanent.

## Terms of Service & Community Rules

A `/rules` page covers the community rules the moderation team enforces, the site's terms of service, and a short
privacy note — linked from the sign-up page (as a consent notice), Settings ("Legal"), and the sidebar's "About
RoBuzz" box, so it's easy to find from anywhere. Edit `client/src/pages/Rules.jsx` to change the wording; it's a
single page, no CMS or database table involved.

## Multiple accounts

You can be signed into up to 5 accounts at once on the same device/browser, and switch between them without having
to log out and back in. Click your name at the bottom of the sidebar to open the account switcher: click any
account to switch to it, click the small **×** next to a non-active one to sign it out, or **Add another account**
to log into (or sign up for) one more. **Log out** signs out just the account you're currently on — if you have
others signed in, it switches to one of them instead of sending you all the way back to the login screen.

## Discord sign-in

A **Continue with Discord** button on the Login, Sign up, and Add another account pages lets someone sign up or log
in using their Discord identity — no password to create or remember up front. The first time someone uses it,
RoBuzz creates an account for them automatically (picking a username from their Discord one, adjusted if it's
already taken); after that, using it again signs them straight back into that same account. If their Discord email
happens to match an existing RoBuzz account's email, *and* Discord has verified that email address, it's linked
to the existing account instead of creating a duplicate — so someone who already signed up the normal way doesn't
end up with two accounts. Their password (if they have one) is completely unaffected by linking.

Since a Discord-created account doesn't have a password yet, Settings shows **Set a password** instead of
**Change password** until they choose to set one — entirely optional (Discord sign-in keeps working either way),
but worth doing if they'd like a way to log in without going through Discord.

This whole feature is optional and safe to ignore: leave it unconfigured and the button still shows, but explains
sign-in isn't set up on this server yet instead of breaking anything. To turn it on:

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications), log in with (or
   create) a Discord account, and click **New Application**. Name it whatever you like (e.g. "RoBuzz") and create it.
2. In the sidebar, click **OAuth2**. Under **Redirects**, click **Add Redirect** and enter your API's address plus
   `/api/auth/discord/callback` — e.g. `https://blockfeed-api.onrender.com/api/auth/discord/callback` (use your
   actual Render API URL from step 3 of [Deploying it live](#deploying-it-live-free)). Click **Save Changes** at
   the bottom.
3. Still on the OAuth2 page, copy the **Client ID**, then click **Reset Secret** (Discord hides it by default) and
   copy the **Client Secret** it shows you.
4. On Render, add three environment variables to your API's Web Service: `DISCORD_CLIENT_ID` and
   `DISCORD_CLIENT_SECRET` (from step 3), and `API_URL` set to that same API address you used in step 2 (e.g.
   `https://blockfeed-api.onrender.com`, no trailing slash and nothing after it). Save — Render redeploys
   automatically, and the button starts working within a minute or two.

## Tech stack

Plain Node.js/Express on the backend, JWT + bcrypt auth, and Multer for image uploads. Plain React + Vite on the
frontend, with `react-router-dom` for routing and hand-written CSS (no UI framework). No required external services
or API keys for local use. Icons are inlined SVG sourced from [Lucide](https://lucide.dev) (ISC license) rather
than a runtime icon library, so there's no icon-package dependency to install.

Storage is pluggable rather than fixed to one engine:

- **Database** — a single SQLite file (via `better-sqlite3`) with zero setup by default. Set a `DATABASE_URL` env
  var and it talks to Postgres instead (any host works; [Supabase](https://supabase.com) is the free one this
  project's deploy guide uses) — the same SQL runs against either, see `server/src/db.js`.
- **Image uploads** — local disk by default. Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` and uploaded images go to
  Supabase Storage instead, so they survive restarts/redeploys on hosts with an ephemeral filesystem — see
  `server/src/utils/upload.js`.

Local dev always uses the zero-setup local versions unless you explicitly set those env vars.

### Images and feed performance

Every uploaded image (avatar, banner, post, ad) is automatically re-encoded on the server with
[sharp](https://sharp.pixelplumbing.com) before it's stored: rotated upright based on the photo's own orientation
data, shrunk to fit a sensible size for what it's used for (avatars to 512×512, banners to 1600×500, post/ad images
to 1600×1600 — never enlarged, only shrunk), and converted to WebP. This is what keeps a phone photo (often several
MB at 4000+ pixels wide) from being served to every visitor at full size — the practical effect is pages that load
much faster and use far less data, especially on a mobile connection. Images are also served with long cache
lifetimes and load lazily (only as they scroll into view), and the feed itself now fetches a post's author, like/
comment/repost counts, and your own like/repost state in one small batch of queries instead of one-by-one per post
— the more posts on a page, the bigger that difference is on a hosted database.

When Supabase Storage is configured (see [Deploying it live](#deploying-it-live-free)), the app generates long-lived
signed URLs for every image rather than relying on the bucket's public/private setting — so it works correctly
whether or not the bucket was ever explicitly marked "Public."

## Getting started

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install     # installs both the server and client (npm workspaces)
npm run seed    # creates server/data.db and fills it with demo accounts + posts
npm run dev     # runs the API on :3001 and the web app on :5173 together
```

Then open **http://localhost:5173**. Re-running `npm run seed` at any point wipes and rebuilds the demo data — handy
if you want to reset back to a clean state.

### Demo accounts

All seeded with the passwords below — for local testing only, obviously.

| Username | Password | Role | Badge |
|---|---|---|---|
| `ben` | `admin1234` | admin | Staff |
| `modmax` | `password123` | moderator | Staff |
| `pixelforge_studios` | `password123` | user | Official |
| `blockbuildertv` | `password123` | user | Content Creator |
| `jamie_verified` | `password123` | user | Verified |
| `alexbuilds`, `mia_plays`, `noobmaster99`, `scriptkid_dev` | `password123` | user | none |
| `shadyseller` | `password123` | user | none — seeded **suspended** |
| `spambot_42` | `password123` | user | none — seeded **banned** |

Log in as `ben` or `modmax` to see the Moderation link in the sidebar — the queue already has a few reports waiting
(including an auto-flagged scam post) so there's something to act on immediately.

Re-seeding wipes everything, which isn't what you want on a real live deployment — for that, see
`ADMIN_BOOTSTRAP_EMAIL` under [Environment variables](#environment-variables), which turns *your own* account into
the admin without touching any real data.

## Project structure

```
blockfeed/
  server/                 Express API
    src/
      routes/             auth, users, posts, search, notifications, reports, admin, support, ads
      middleware/         JWT auth, role/active-account guards
      utils/              serializers, content filter, notifications, uploads (sharp resize/webp
                          pipeline + signed URLs), constants, adminBootstrap (see
                          ADMIN_BOOTSTRAP_EMAIL below), normalize (env-value cleanup),
                          discord (OAuth exchange, see "Discord sign-in")
      db.js               SQLite/Postgres adapter + shared schema (creates tables on first run)
      seed.js             demo data generator
    seed-assets/           placeholder post images used by the seed script
    uploads/                local-disk uploads land here at runtime (gitignored) — used only
                            when Supabase Storage isn't configured, see "Deploying it live"
  client/                 React + Vite app
    src/
      components/         PostCard, Composer, BadgeIcon, Sidebar, ReportModal, AdCard,
                          ImageLightbox, MentionTextarea, DiscordButton, ...
      pages/               Home, Explore, Profile, PostDetail, Search, Notifications, Support,
                            Rules, AddAccount (switch/add accounts), OAuthCallback (Discord
                            redirect landing page),
                            admin/ (Overview, Reports, Users, Tickets, AuditLog, Ads)
      context/AuthContext.jsx
      api.js               fetch wrapper for the backend API + multi-account session storage
```

## Environment variables

The server auto-generates `server/.env` with a random `JWT_SECRET` the first time it runs, so there's nothing to
configure for local use. See `server/.env.example` (server) and `client/.env.example` (client) for everything
that's available — `PORT` / `JWT_SECRET` / `CLIENT_ORIGIN` plus the production-only ones (`DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`, `VITE_API_URL`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `API_URL`) used in the deploy guide below. `CLIENT_ORIGIN`, `SUPABASE_URL` and
`SUPABASE_BUCKET` are trimmed and cleaned up automatically on boot (a pasted trailing slash or stray extra path
won't break anything — see `server/src/utils/normalize.js`), so pasting them straight from Render/Supabase's own
pages is enough.

One more, optional: **`ADMIN_BOOTSTRAP_EMAIL`** — set it to an email address and that account is automatically
promoted to admin, whether it already exists or signs up later. No database access, no script, no terminal —
just set the env var (on Render: Environment tab) and sign up (or redeploy, if the account already exists) with
that email. Safe to leave set permanently; it only ever promotes, never demotes, and does nothing once that
account is already an admin. This is the recommended way to get a real admin account on a live deployment —
see step 3 of [Deploying it live](#deploying-it-live-free).

Also optional: **`DISCORD_CLIENT_ID`** / **`DISCORD_CLIENT_SECRET`** / **`API_URL`** turn on "Continue with
Discord" sign-in — see [Discord sign-in](#discord-sign-in) above for what it does and the full setup walkthrough.

## Pushing this to GitHub

This folder is already a git repository with an initial commit. To push it to a new GitHub repo:

```bash
# create an empty repo at https://github.com/new first (don't add a README/license there), then:
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

If you'd rather have GitHub's CLI do it for you (and you have `gh` installed and logged in):

```bash
gh repo create <repo-name> --public --source=. --push
```

## Deploying it live (free)

The app is wired to run either fully local (SQLite + local disk, zero setup) or fully live (Postgres + Supabase
Storage, all free tiers) based purely on which environment variables are set — no code changes needed either way.
Going live uses three free accounts: **GitHub** (hosts the code), **Supabase** (Postgres database + file storage),
and **Render** (runs the API and serves the website). Total cost is $0/month within the free tiers below.

**1. Push to GitHub** — see [Pushing this to GitHub](#pushing-this-to-github) above if you haven't already.

**2. Create a Supabase project** — [supabase.com](https://supabase.com) → New Project (pick any name/region, save
the database password somewhere). Once it's ready:

- Click **Connect** at the top of the project page, and copy the **Session pooler** connection string (not
  "Direct connection" — that needs IPv6, which most free hosts don't have; not "Transaction pooler" either — this
  app keeps a persistent connection pool open, which transaction mode isn't built for). Fill in the database
  password you set. This is your `DATABASE_URL`.
- Under **Storage**, create a new bucket (e.g. `blockfeed-uploads`) — this is where uploaded avatars, banners,
  post images, and ad images live. You do **not** need to mark it "Public": the app generates its own long-lived
  signed URLs for every image (using the secret key from the next step), which work regardless of the bucket's
  public/private setting — so it doesn't matter which one you pick.
- Under **Settings → API Keys**, copy the **secret key** (or the legacy `service_role` key, whichever your project
  shows) — never the publishable/`anon` one. This is your `SUPABASE_SERVICE_KEY`.

**3. Deploy the API as a Render Web Service** — [render.com](https://render.com) → New → Web Service → connect
your GitHub repo. Set:

| Field | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Add environment variables (Environment tab): `DATABASE_URL` (from step 2), `JWT_SECRET` (any long random string),
`SUPABASE_URL` (your project URL, in Settings → API), `SUPABASE_SERVICE_KEY` (from step 2), `SUPABASE_BUCKET`
(the bucket name), `CLIENT_ORIGIN` (fill this in after step 4, then redeploy), and `ADMIN_BOOTSTRAP_EMAIL` set to
whichever email address you're going to sign up with — that's how you get your own real admin account (details
in [Environment variables](#environment-variables) above; step 5 below covers this too). Deploy, then confirm it's
up by visiting `https://<your-api-name>.onrender.com/api/health` — it should show `{"ok":true,"db":"postgres"}`.

**4. Deploy the website as a Render Static Site** — New → Static Site → same repo. Set:

| Field | Value |
|---|---|
| Root Directory | `client` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

Add one environment variable: `VITE_API_URL` set to your API's URL from step 3 (e.g.
`https://blockfeed-api.onrender.com`) — this has to be set *before* the first deploy, since Vite bakes it into the
build. Then add a rewrite rule (Redirects/Rewrites tab) so client-side routing works on refresh/deep links:
Source `/*`, Destination `/index.html`, Action **Rewrite**.

Go back to the Web Service from step 3 and set `CLIENT_ORIGIN` to this site's URL, then redeploy it (CORS needs to
know the real origin).

**5. Get your admin account** — open your Render static site's URL (that's your live RoBuzz) and sign up normally,
using the same email you put in `ADMIN_BOOTSTRAP_EMAIL` back in step 3. That account becomes admin automatically —
no terminal, no database access needed. (If you set `ADMIN_BOOTSTRAP_EMAIL` *after* already signing up, the
promotion happens the next time the API redeploys/restarts instead — either order works.)

This is all you need for a real launch — a live site starts completely empty, with just your own admin account.

*Optional: seed demo content instead.* If you'd rather start with a full example community (demo accounts, posts,
comments, reports already in the queue) — useful for showing the app off, not for a real launch — you can run the
seed script from your own machine, if you have [Node.js](https://nodejs.org) installed there, with the same
`DATABASE_URL` from step 2:

```bash
# macOS/Linux
DATABASE_URL="postgresql://...your Supabase session-pooler string..." npm run seed -w server

# Windows PowerShell
$env:DATABASE_URL="postgresql://...your Supabase session-pooler string..."; npm run seed -w server
```

**Only run this once, and only instead of (not after) real signups** — it **wipes and rebuilds everything**, so
running it later would erase any real posts/accounts your live site has by then. It also creates its own admin
account (`ben` / `admin1234`, see [Demo accounts](#demo-accounts)) — change that password right away if you use it.

*Optional: turn on "Continue with Discord" sign-in.* See [Discord sign-in](#discord-sign-in) above for the full
walkthrough — in short, create a Discord application, add `<your API URL>/api/auth/discord/callback` as its
redirect, then add `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `API_URL` to the Web Service's environment
variables from step 3. Skip this entirely and the site works exactly the same, just without that button doing
anything.

**Notes:**
- Render's free web services spin down after 15 minutes idle and take about a minute to wake back up on the next
  request — the site itself loads instantly either way (it's static files), only the very first API call after a
  quiet spell is slow. Not a bug.
- Future updates: once GitHub is connected to Render, `git push` (or GitHub Desktop's Push button) redeploys both
  services automatically.
- Render also offers its own free Postgres, but it expires after 30 days — Supabase's free Postgres doesn't, which
  is why this guide uses Supabase for the database.

## Known limitations

This is a complete, working app, not a hardened enterprise deployment. A few things worth knowing:

- **Roblox account linking is display-only** — it looks up a Roblox username via Roblox's public API and shows
  that account's name/avatar on your profile. It is **not** "Sign in with Roblox" and doesn't verify ownership;
  anyone can type any Roblox username. Real Roblox OAuth would require registering a developer app on Roblox's
  Creator Hub under your own Roblox account, which is a manual step only you can do.
- **`npm audit`** currently reports a few moderate advisories inherited from Express 4's `qs`/`body-parser`
  dependency chain, only fixable by moving to Express 5 (a breaking change this project hasn't been tested against).
  Not exploitable through anything this app's routes expose, but worth knowing about.
- No rate limiting, no email verification, no *self-service* "forgot password" flow, no automated test suite. Staff
  can reset a user's password from the admin Users page, which covers a user locking themselves out, but there's no
  automated email-based reset yet.
- No direct messages or Stories — the spec here is the core feed/profile/moderation experience. Both would fit
  naturally into the existing data model if you want to add them.
- Free-tier hosting limits apply if you deploy it (see "Deploying it live" above) — e.g. Render's free web service
  sleeps after 15 minutes idle and takes ~1 minute to wake up on the next request.
- Signed-in accounts (see "Multiple accounts" above) live in the browser's local storage, so they're per-browser —
  switching computers or browsers means signing in again there, and clearing site data signs everything out.
- If someone signs up via Discord without a public/verified email on their Discord account, RoBuzz gives them a
  placeholder `@users.robuzz.local` email in the Users table instead of a real one — expected, not a bug, and it
  doesn't affect anything since Discord accounts sign in through Discord, not by email/password.

## License

All rights reserved — see `LICENSE`. This is proprietary code: nobody else may copy, modify, or
redistribute it without permission.

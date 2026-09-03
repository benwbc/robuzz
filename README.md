# BlockFeed

BlockFeed is a full-stack social platform for the Roblox community — a mashup of X (Twitter) and Instagram, with a
real moderation system underneath. It's a fan-made, independent project and is **not affiliated with or endorsed by
Roblox Corporation**.

Short text posts, image posts, likes, comments, reposts, follows, an Instagram-style Explore grid, notifications,
search — and four verified-style badges plus a working staff moderation dashboard (reports queue, auto-flagging,
suspensions/bans, an audit log, and role-based permissions).

Everything runs locally with no paid services, no API keys, and no external database — it's a real working app you
can run with two commands.

## Badges

| Badge | Color | Meaning |
|---|---|---|
| Verified | 🔵 Blue | Verified account |
| Staff | 🟢 Green | BlockFeed staff member |
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
  a Users table to search accounts and change role/badge/status directly, and an Audit Log of every action taken.
- **Enforcement is real** — a suspended or banned account is blocked from logging in (with the reason and, for
  suspensions, the return date shown), and can't post, like, comment, follow, or report while active. Suspensions
  lift automatically once they expire.

## Tech stack

Plain Node.js/Express on the backend with a single SQLite file for storage (via `better-sqlite3` — no database
server to install), JWT + bcrypt auth, and Multer for local image uploads. Plain React + Vite on the frontend, with
`react-router-dom` for routing and hand-written CSS (no UI framework). No external services, no API keys.

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

## Project structure

```
blockfeed/
  server/                 Express API
    src/
      routes/             auth, users, posts, search, notifications, reports, admin
      middleware/         JWT auth, role/active-account guards
      utils/              serializers, content filter, notifications, uploads, constants
      db.js               SQLite schema (creates tables on first run)
      seed.js             demo data generator
    seed-assets/           placeholder post images used by the seed script
    uploads/                user-uploaded images land here at runtime (gitignored)
  client/                 React + Vite app
    src/
      components/         PostCard, Composer, BadgeIcon, Sidebar, ReportModal, ...
      pages/               Home, Explore, Profile, PostDetail, Search, Notifications,
                            admin/ (Overview, Reports, Users, AuditLog)
      context/AuthContext.jsx
      api.js               single fetch wrapper for the whole backend API
```

## Environment variables

The server auto-generates `server/.env` with a random `JWT_SECRET` the first time it runs, so there's nothing to
configure for local use. See `server/.env.example` for what's available (`PORT`, `JWT_SECRET`, `CLIENT_ORIGIN`) if
you do want to set your own.

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

## Deploying it live (optional, still free)

This project is built to run locally, but if you want a real `https://` link later, the free-tier path is:

1. Push the code to GitHub (above).
2. Swap SQLite for a free hosted Postgres, e.g. [Supabase](https://supabase.com) — its free tier is a real
   persistent Postgres database, unlike most free hosts' *disks*, which get wiped on every restart.
3. Deploy the `server/` folder as a web service on a free host such as [Render](https://render.com) (set
   `DATABASE_URL` to your Supabase connection string, and `JWT_SECRET` to a long random value), and deploy `client/`
   as a static site (`npm run build` produces `client/dist`) pointed at your API's URL.

This isn't wired up out of the box — the backend talks to SQLite directly — but the schema in `server/src/db.js` is
plain SQL and translates to Postgres with only minor syntax changes if you want to take this further.

## Known limitations

This is a complete, working prototype, not a production deployment. A few things worth knowing:

- **SQLite + local disk storage** — fine for local use or a single small server; won't survive most free hosts'
  ephemeral filesystems (see "Deploying it live" above).
- **`npm audit`** currently reports a few moderate advisories inherited from Express 4's `qs`/`body-parser`
  dependency chain, only fixable by moving to Express 5 (a breaking change this project hasn't been tested against).
  Not exploitable through anything this app's routes expose, but worth knowing about.
- No rate limiting, no email verification, no password-reset flow, no automated test suite.
- No direct messages or Stories — the spec here is the core feed/profile/moderation experience. Both would fit
  naturally into the existing data model if you want to add them.

## License

MIT — see `LICENSE`. Do whatever you like with it.

# Plankway

A light daily browser puzzle based on Hashiwokakero ("Bridges"), with a twist: **reefs**.
Connect all islands with bridges; a bridge can never cross a reef.

## Structure

```
packages/core/   pure TypeScript: model, rules, solvers, generator, seeded RNG (no DOM)
apps/web/        Vite + Preact + canvas renderer
apps/api/        Cloudflare Worker (Hono) + D1 migrations
scripts/         CLI: generate daily puzzles and write them to D1
.github/         CI (tests) and the daily generation cron
```

## Local development

Requirements: Node ≥ 22.18 (runs `.ts` files natively), pnpm 10.

```bash
pnpm install
pnpm test        # all unit tests
pnpm typecheck   # strict TypeScript
pnpm bench       # generator timing per difficulty (optional: pnpm bench -- 50)
```

Full stack (no Cloudflare account needed, everything runs locally):

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars   # once: local secret
pnpm db:setup:local    # once: D1 migrations, the next 14 days of puzzles and 1000 endless levels
pnpm dev:api           # Worker on http://localhost:8787 (wrangler, local D1)
pnpm dev:web           # app on http://localhost:5173, /api is proxied to the Worker
```

The web app also works without the API: it then generates the daily locally and syncs
results once the API is reachable.

## Core (`packages/core`)

| Module | What it does |
|---|---|
| `rng.ts` | mulberry32 PRNG with a string seed. Core never uses `Math.random()`. |
| `model.ts` | `Puzzle`, `Bridge`, `Solution`; compact JSON wire format with validation. |
| `board.ts` | Geometry: possible connections, crossings, connections blocked by a twist. |
| `rules/` | Twist modules. `rules/reefs.ts` is the reef twist; switch it off with `createRules({ reefs: false })`. |
| `validate.ts` | Full rule check of a solution (used by the server), plus island status for UI feedback. |
| `solver/techniques.ts` | Human-style deductions, each with a difficulty weight. |
| `solver/logical.ts` | Solves without guessing; records every step. |
| `solver/backtrack.ts` | Exhaustive search that counts solutions up to 2 (uniqueness proof). |
| `generator.ts` | Constructive generator (see below). |
| `difficulty.ts` | Score = 100 × hardest technique + number of steps; tiers easy → expert. |
| `curves.ts` | Daily presets per weekday (Mon 7×7 → Sun 10×10) and the endless curve. |
| `hints.ts` | Next logical step from the player's grid, or flags a wrong bridge. |

### Deduction techniques

| Technique | Weight | Idea |
|---|---|---|
| full-island | 1 | Island has all its bridges → nothing more on the other connections. |
| all-bridges | 1 | Island needs every bridge it can still get (e.g. a 4 with two neighbours). |
| crossing | 1 | A placed bridge rules out the bridge it crosses. |
| cap | 1 | Remaining capacity caps a connection (a 1 never takes a double bridge). |
| forced-minimum | 2 | The other neighbours can't supply enough → at least k bridges here. |
| isolation | 3 | This bridge would close off a finished group from the rest. |
| connectivity | 4 | A group has only one way out left, so it must be used. |
| lookahead | 6 | Trying an option leads to a contradiction a few simple steps later. |

### Generator

1. Place a random island; repeatedly pick an island, direction and distance, and add a new
   island with a single or double bridge, never crossing existing islands or bridges.
2. Add a few extra bridges along free straight lines to create loops.
3. Derive the island numbers from the bridges.
4. Twist modules place obstacles: reefs go on water cells of connections that are *not*
   part of the solution.
5. Solve with only the techniques allowed for this difficulty. If the solver gets stuck,
   a twist module blocks one of the open alternatives (another reef) and we try again.
6. Accept only if the backtracking solver finds exactly one solution.

Every generated puzzle is deterministic for a given seed and config.

### Benchmark (desktop, Node 24, 30 puzzles per row)

| Setting | avg | p95 |
|---|---|---|
| Daily Mon (7×7, 10 islands) | 1 ms | 3 ms |
| Daily Sun (10×10, 22 islands) | 32 ms | 78 ms |
| Endless level 1–30 | ≤ 2 ms | ≤ 5 ms |
| Endless plateau, expert variant | 18 ms | 47 ms |

A mid-range phone is roughly 3–5× slower, which keeps endless well under the 300 ms target.

## Web app (`apps/web`)

| Module | What it does |
|---|---|
| `game/session.ts` | Immutable play state: cycle a bridge (0 → 1 → 2 → 0), undo, reset, hints, win detection. Blocks bridges that would cross. |
| `game/view.ts` | Owns the canvas: DPR-sharp sizing, redraws, pointer and keyboard input. |
| `game/renderer.ts` | Draws the board from CSS custom properties (light/dark). Status badges use shape as well as colour. |
| `game/layout.ts` | Grid ↔ pixel maths and hit testing (touch targets ≥ 44 px). |
| `workers/generator.worker.ts` | Endless puzzles are generated off the main thread; the next level is prefetched. |
| `game/storage.ts` | Endless level, record and the game in progress (localStorage; moves to IndexedDB with daily stats). |
| `i18n.ts` | All UI strings, English and Dutch. |

Controls: drag from island to island (or just drag in a direction), tap an island and then a
neighbour, or tap a bridge. Keyboard: arrows move between islands, space selects, an arrow then
builds in that direction, Esc cancels.

## Daily mode

- **Numbering:** Plankway #1 = 2026-09-25 (`LAUNCH_DATE` in `packages/core/src/daily.ts`). The number
  follows the player's *local* calendar date, like a newspaper.
- **Difficulty:** by weekday, Monday easiest → Sunday hardest (`DAILY_PRESETS`).
- **Same puzzle for everyone:** `generateDaily(n)` uses seed `bridgle-daily-<n>`. Until the API exists
  (milestone 4) the browser generates it locally in the worker; the server script will make the same call.
- **Hints are allowed** and are mentioned in the shared result.
- **Stats** live in IndexedDB (`bridgle` → `daily`, one record per puzzle number) and include the game in
  progress. Played = started, streak = consecutive puzzle numbers solved; today's unsolved puzzle
  doesn't break the streak until the day is over.
- **Share text** (no spoilers): five islands, and hints and undos wash some away.

```
Plankway #42 🌉 2:31
🏝️🏝️🏝️🏝️🏝️ 0 undos
plankway.com
```

The URL in the share text comes from `VITE_SITE_URL` (default `plankway.com`).

## API (`apps/api`)

Cloudflare Worker with Hono, data in D1 (`migrations/`). All routes live under `/api`; in
production the Worker is routed on the same domain as the site, so no CORS is needed.

| Route | What it does |
|---|---|
| `GET /api/daily/:date` | Puzzle for an ISO date. Only dates that have started somewhere on earth (≤ today at UTC+14). Never includes the solution. |
| `POST /api/profile` | Creates an anonymous profile. Token in an `HttpOnly; Secure; SameSite=Lax` cookie, returns the id and a 4-word recovery code. |
| `POST /api/daily/:number/result` | `{ timeMs, undos, hints, solution }`. The server checks the solution against the rules; the first accepted result stands. Returns stats. |
| `GET /api/profile/stats?today=n` | Stats, streaks and results. `today` is the client's local puzzle number, clamped to what is possible right now. |
| `POST /api/profile/recover` | `{ code }` links this device to an existing profile (new token for this device). |
| `POST /api/profile/recovery-code` | Replaces a lost recovery code; the old one stops working. |
| `DELETE /api/profile` | Deletes the profile and all its results (GDPR). |

- Tokens, recovery codes, IPs and sign-in ids are only stored as HMAC-SHA256 with the `HASH_PEPPER` secret.
- Sessions: one row per device in `sessions`, so a profile can be used on several devices at once.
  Recovering a profile or signing in adds a session; it never signs out the other devices.
- Rate limits per hour: profile creation 10/IP, recovery 10/IP, daily results 60/profile, endless results
  240/profile, start tokens 300/profile.
- Verified times: `POST /api/{daily|endless}/:id/start` returns a start token (an HMAC over profile, puzzle
  and server time; nothing is stored). A result sent with that token is `verified` when its time fits inside
  the time the server saw pass (plus 5 s) and is at least 150 ms per bridge. Unverified results still count
  for streaks and progress; leaderboards will only use verified ones.
- Tests run the real app against SQLite (`node:sqlite`) with the same migrations.

### Accounts (sign in with Google)

Optional. Without an account everything keeps working with the anonymous profile.

- Flow: `GET /api/auth/google/start` → Google (authorization code + PKCE + nonce, scope `openid`
  only: no e-mail, no name) → `GET /api/auth/google/callback` → back to the app with `?login=new`,
  `welcome-back`, `cancelled` or `error`. State, verifier and nonce travel in a 10-minute httpOnly cookie.
- The ID token comes straight from Google's token endpoint over TLS, so issuer, audience, expiry and
  nonce are checked instead of its signature (OpenID Connect Core 3.1.3.7).
- A new account is linked to the device's current profile. Signing in to an existing account on a
  device with an anonymous profile moves that progress into the account and deletes the anonymous one.
- Once signed in: display name (3–20 characters, word filter in `apps/api/src/names.ts`) and country
  (suggested from Cloudflare's `cf.country`), via `PUT /api/profile/account`. `GET /api/profile/me`
  returns the account and endless progress. `POST /api/auth/logout` ends this device's session only.
- Setup: create an OAuth client ("Web application") in Google Cloud Console with redirect URIs
  `https://plankway.com/api/auth/google/callback`, `https://www.plankway.com/api/auth/google/callback`
  and `http://localhost:5173/api/auth/google/callback`, then `wrangler secret put GOOGLE_CLIENT_ID` and
  `wrangler secret put GOOGLE_CLIENT_SECRET`. The button only appears when both are set. Locally, put
  them in `.dev.vars` together with `SITE_ORIGIN=http://localhost:5173`.

### Leaderboards (`apps/api/src/leaderboard.ts`)

Only players with an account and a chosen name appear; anonymous progress counts once it moves
into an account. Each board is world-wide or `?country=XX`, shows the top 50 and the player's own
place (or why they're not on it: `no-name`, `not-played`, `hints`, `unverified`).

- `GET /api/leaderboard/daily/:number`: fastest verified time without hints.
- `GET /api/leaderboard/endless/level/:level`: same, per endless level.
- `GET /api/leaderboard/endless/run`: furthest endless level, counted as the unbroken run from
  level 1 (hints allowed). Kept in `profiles.endless_run` whenever endless results are added or
  merged; ties go to whoever got there first.

### Friends (`apps/api/src/friends.ts`)

Needs an account with a name. Every player gets a friend code (8 characters without 0/O/1/I,
shown as `K7M2-QX9P`); entering it, or opening the invite link `/?friend=CODE`, makes both players
friends right away. Friends see nothing beyond the public boards: every leaderboard takes
`?friends=1` for "me and my friends". Either side can remove the friendship (`DELETE
/api/friends/:key`, an opaque per-viewer key), and `POST /api/friends/code` replaces the code so
the old one stops working. At most 200 friends; adding and renewing are rate-limited.

### Daily puzzles and endless levels

`node scripts/generate-daily.ts --apply local|remote` fills D1 up to 14 days ahead (idempotent).
`node scripts/generate-endless.ts --apply local|remote` keeps at least 1000 endless levels in D1, and always
500 past the furthest level anyone has solved. Every level has a fixed seed (`endless-<level>`), so all
players get the same puzzle; offline, the app builds the same level locally from that seed.
`.github/workflows/daily.yml` runs both every night; if a run fails, the buffer covers it.
Without `--apply` they only write SQL to `scripts/out/`.

### Hosting & deploying

One Cloudflare Worker, `plankway`, serves both the site (static assets from `apps/web/dist`, SPA
fallback) and the API (only `/api/*` runs Worker code). Same origin, so the profile cookie just works;
static asset requests are free and don't count towards the Workers request quota.

- D1 database `plankway` in Western Europe (`apps/api/wrangler.toml`); secret `HASH_PEPPER` set with
  `wrangler secret put HASH_PEPPER` (never in git).
- Deploy site + API: `pnpm run deploy` (builds the web app, then `wrangler deploy`).
- Daily puzzles and endless levels: `node scripts/generate-daily.ts --apply remote` and
  `node scripts/generate-endless.ts --apply remote` (both also apply D1 migrations) — also run nightly by GitHub Actions,
  which needs the repository secrets `CLOUDFLARE_API_TOKEN` (D1 edit) and `CLOUDFLARE_ACCOUNT_ID`.
- `apps/web/public/_headers`: long cache for hashed assets, no cache for `sw.js`, basic security headers.

## Look & feel (`apps/web/src/game`)

| Module | What it does |
|---|---|
| `art.ts` | Canvas drawing primitives: seeded island blobs (sand + grass), palms/rocks/huts, reef rocks with foam, wooden plank bridges with rope rails, waves, boat and gulls. |
| `renderer.ts` | Composes a frame: sea (+ moonlight at night), waves, reefs, bridges with build/fade animations, splashes, islands with number signs and status flags, win scene. |
| `view.ts` | Frame loop: idle water at ~20 fps, 60 fps only while something animates. Win celebration is skippable (tap or any key). |
| `theme.ts` | Day/night: follows `prefers-color-scheme`, with a manual override (`data-theme` on `<html>`). |
| `sound.ts` | Synthesized effects with Web Audio (plank clicks, splash, bonk, hint, win). No audio files. |

- All colours are CSS custom properties (`styles.css`), one set for day and one for night.
- `prefers-reduced-motion`: no waves, no pulsing, no plank/splash animation, no win scene.
- Status is never colour-only: a flag on complete islands, a "!" badge and red ring when over.
- Screen readers get announcements for focus, selection, every bridge change and the win.

## PWA & performance

- **Installable:** `public/manifest.webmanifest` with icons in `public/icons/`. The icons are cut
  from the logo in `assets/brand/plankway-logo.png` by `node scripts/make-icons.ts` (needs ffmpeg):
  the round badge, a padded maskable version for Android, and a 256-colour palette to keep them small.
- **Offline:** `apps/web/sw/sw.js` is turned into `dist/sw.js` by the `bridgle-sw` plugin in
  `vite.config.ts`, which injects every built file (app, CSS, generator worker, icons) and a
  content hash as cache version.
  - Static files: cache first. Pages: network first, cached app shell offline.
  - `/api/daily/*`: network first with a cached copy; other `/api` calls are never cached.
  - Endless is generated in the (precached) worker, the daily falls back to local generation,
    results sync when back online — the whole game works without a connection.
- **Updates:** a new version waits until the player taps "Reload" in the banner; it never
  reloads mid-puzzle. The service worker only registers in production builds.
- **Budget:** `pnpm check:bundle` builds the app and fails above 100 KB gzip of initial JS
  (currently ~30 KB). It runs in CI.
- **Lighthouse (mobile, production preview):** 100 performance, 100 accessibility,
  100 best practices, 100 SEO. LCP ≈ 1.5 s, TBT ≤ 10 ms, CLS 0.

Local production check: `pnpm build:web && pnpm --filter @bridgle/web preview` (http://localhost:4173,
`/api` is proxied to `pnpm dev:api`).

## Ads, consent and legal pages

- **Ads are off by default.** Set `VITE_ADSENSE_CLIENT` and the slot ids in
  `apps/web/.env.production.local` (see `.env.example`). Without them no ad or consent script
  is ever loaded.
- `AdSlot` reserves its height (no layout shift) and only appears below the board and in the
  result dialog. Endless shows a closable interstitial between levels every
  `VITE_AD_INTERSTITIAL_EVERY` solved levels, never during a puzzle.
- Scripts load lazily when a slot scrolls into view: first Google's certified CMP (IAB TCF v2.2),
  then — once the player has made a choice or a stored choice is loaded — AdSense. Personalized /
  non-personalized / no ads follows the CMP's TC string. Settings → Privacy choices reopens it.
- Pages with their own URL: `/how-to-play`, `/about`, `/privacy`, `/cookies` (loaded on demand).
  Texts live in `apps/web/src/content/pages.ts` (NL + EN) and describe what the app and API
  actually do. **Draft — have them reviewed.** The controller details are in
  `apps/web/src/content/legal.ts`.
- `pnpm check:launch` lists what still has to be filled in before going live.

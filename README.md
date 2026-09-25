# Bridgle

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
pnpm db:setup:local    # once: D1 migrations + the next 14 days of puzzles
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

- **Numbering:** Bridgle #1 = 2026-09-25 (`LAUNCH_DATE` in `packages/core/src/daily.ts`). The number
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
Bridgle #42 🌉 2:31
🏝️🏝️🏝️🏝️🏝️ 0 undos
bridgle.com
```

The URL in the share text comes from `VITE_SITE_URL` (default `bridgle.com`).

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

- Tokens, recovery codes and IPs are only stored as HMAC-SHA256 with the `HASH_PEPPER` secret.
- Rate limits per hour: profile creation 10/IP, recovery 10/IP, results 60/profile.
- Tests run the real app against SQLite (`node:sqlite`) with the same migrations.

### Daily puzzles

`node scripts/generate-daily.ts --apply local|remote` fills D1 up to 14 days ahead (idempotent).
`.github/workflows/daily.yml` runs it every night; if a run fails, the buffer covers it.
Without `--apply` it only writes SQL to `scripts/out/`.

### Deploying (not done yet — needs a Cloudflare account)

1. `pnpm --filter @bridgle/api exec wrangler login`
2. `pnpm --filter @bridgle/api exec wrangler d1 create bridgle` → put the id in `apps/api/wrangler.toml`
3. `pnpm --filter @bridgle/api db:migrate:remote`
4. `pnpm --filter @bridgle/api exec wrangler secret put HASH_PEPPER` (long random value)
5. `pnpm --filter @bridgle/api deploy`
6. GitHub secrets `CLOUDFLARE_API_TOKEN` (D1 edit rights) and `CLOUDFLARE_ACCOUNT_ID` for the cron.

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

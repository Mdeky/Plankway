# Bridgle

A light daily browser puzzle based on Hashiwokakero ("Bridges"), with a twist: **reefs**.
Connect all islands with bridges; a bridge can never cross a reef.

## Structure

```
packages/core/   pure TypeScript: model, rules, solvers, generator, seeded RNG (no DOM)
apps/web/        Vite + Preact + canvas renderer          (milestone 2)
apps/api/        Cloudflare Worker (Hono) + D1            (milestone 4)
scripts/         CLI for daily puzzle generation          (milestone 4)
```

## Local development

Requirements: Node ≥ 22.18 (runs `.ts` files natively), pnpm 10.

```bash
pnpm install
pnpm test        # all unit tests
pnpm typecheck   # strict TypeScript
pnpm bench       # generator timing per difficulty (optional: pnpm bench -- 50)
```

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

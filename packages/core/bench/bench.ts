// Average generation time per difficulty. Run with: pnpm bench
// Target for endless: < 300 ms per puzzle on a mid-range phone (expect ~3-5x slower than a desktop).
import { DAILY_PRESETS, endlessConfig, generatePuzzle, type GeneratorConfig } from '../src/index.ts';

declare const console: { log(...args: unknown[]): void };
declare const performance: { now(): number };
declare const process: { argv: string[] };

const samples = Number(process.argv[2] ?? 30);
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function run(label: string, config: GeneratorConfig) {
  const times: number[] = [];
  let attempts = 0;
  let weight = 0;
  let reefs = 0;
  let hitMin = 0;
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    const g = generatePuzzle(config, `bench-${label}-${i}`);
    times.push(performance.now() - t0);
    attempts += g.attempts;
    weight += g.report.maxWeight;
    reefs += g.puzzle.reefs.length;
    if (g.report.maxWeight >= config.minWeight) hitMin++;
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]!;
  console.log(
    `${label.padEnd(12)} ${`${config.width}x${config.height}`.padEnd(6)} avg ${avg.toFixed(1).padStart(7)} ms   p95 ${p95
      .toFixed(1)
      .padStart(7)} ms   attempts ${(attempts / samples).toFixed(1).padStart(5)}   weight ${(weight / samples).toFixed(1)}   reefs ${(
      reefs / samples
    ).toFixed(1)}   minWeight hit ${Math.round((hitMin / samples) * 100)}%`,
  );
}

console.log(`Bridgle generator benchmark (${samples} puzzles per row)\n`);
DAILY_PRESETS.forEach((preset, i) => run(`daily ${days[i]}`, preset));
console.log('');
for (const level of [1, 5, 10, 15, 20, 25, 30, 40, 50]) run(`endless ${level}`, endlessConfig(level));

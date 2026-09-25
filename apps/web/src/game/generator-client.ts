import { parsePuzzle, parseSolution, type Puzzle, type Solution } from '@bridgle/core';
import type { GenerateJob, GenerateRequest, GenerateResponse } from '../workers/protocol.ts';

export interface GeneratedGame {
  puzzle: Puzzle;
  solution: Solution;
}

export interface EndlessPuzzle extends GeneratedGame {
  level: number;
}

/** Generates puzzles off the main thread so the UI never stutters. */
export class GeneratorClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (r: GenerateResponse) => void>();

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev: MessageEvent<GenerateResponse>) => {
        const resolve = this.pending.get(ev.data.id);
        this.pending.delete(ev.data.id);
        resolve?.(ev.data);
      };
    }
    return this.worker;
  }

  private async run(job: GenerateJob): Promise<GeneratedGame> {
    const id = this.nextId++;
    const response = await new Promise<GenerateResponse>((resolve) => {
      this.pending.set(id, resolve);
      const request: GenerateRequest = { ...job, id };
      this.getWorker().postMessage(request);
    });
    if (!response.ok) throw new Error(response.error);
    return { puzzle: parsePuzzle(response.puzzle), solution: parseSolution(response.solution) };
  }

  async generate(level: number, seed: string): Promise<EndlessPuzzle> {
    return { level, ...(await this.run({ kind: 'endless', level, seed })) };
  }

  daily(number: number): Promise<GeneratedGame> {
    return this.run({ kind: 'daily', number });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

/** Random per-device seed. Uses crypto, never Math.random(). */
export function randomSeed(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

import { parsePuzzle, parseSolution, type Puzzle, type Solution } from '@bridgle/core';
import type { GenerateRequest, GenerateResponse } from '../workers/protocol.ts';

export interface EndlessPuzzle {
  level: number;
  puzzle: Puzzle;
  solution: Solution;
}

/** Generates endless puzzles off the main thread so the UI never stutters. */
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

  async generate(level: number, seed: string): Promise<EndlessPuzzle> {
    const request: GenerateRequest = { id: this.nextId++, level, seed };
    const response = await new Promise<GenerateResponse>((resolve) => {
      this.pending.set(request.id, resolve);
      this.getWorker().postMessage(request);
    });
    if (!response.ok) throw new Error(response.error);
    return { level, puzzle: parsePuzzle(response.puzzle), solution: parseSolution(response.solution) };
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

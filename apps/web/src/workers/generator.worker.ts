import { endlessConfig, generatePuzzle, serializePuzzle, serializeSolution } from '@bridgle/core';
import type { GenerateRequest, GenerateResponse } from './protocol.ts';

// Typed view of the dedicated worker scope (the DOM and WebWorker libs can't be mixed).
const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<GenerateRequest>) => void) | null;
  postMessage(message: GenerateResponse): void;
};

scope.onmessage = (ev) => {
  const { id, level, seed } = ev.data;
  const t0 = performance.now();
  let response: GenerateResponse;
  try {
    const g = generatePuzzle(endlessConfig(level), seed);
    response = {
      id,
      ok: true,
      puzzle: serializePuzzle(g.puzzle),
      solution: serializeSolution(g.solution),
      ms: performance.now() - t0,
    };
  } catch (err) {
    response = { id, ok: false, error: String(err) };
  }
  scope.postMessage(response);
};

import { generateDaily, generateEndless, serializePuzzle, serializeSolution } from '@bridgle/core';
import type { GenerateRequest, GenerateResponse } from './protocol.ts';

// Typed view of the dedicated worker scope (the DOM and WebWorker libs can't be mixed).
const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<GenerateRequest>) => void) | null;
  postMessage(message: GenerateResponse): void;
};

scope.onmessage = (ev) => {
  const req = ev.data;
  const t0 = performance.now();
  let response: GenerateResponse;
  try {
    const g = req.kind === 'daily' ? generateDaily(req.number) : generateEndless(req.level);
    response = {
      id: req.id,
      ok: true,
      puzzle: serializePuzzle(g.puzzle),
      solution: serializeSolution(g.solution),
      ms: performance.now() - t0,
    };
  } catch (err) {
    response = { id: req.id, ok: false, error: String(err) };
  }
  scope.postMessage(response);
};

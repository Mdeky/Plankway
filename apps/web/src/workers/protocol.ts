export type GenerateJob = { kind: 'endless'; level: number } | { kind: 'daily'; number: number };

export type GenerateRequest = GenerateJob & { id: number };

export type GenerateResponse =
  | { id: number; ok: true; puzzle: string; solution: number[]; ms: number }
  | { id: number; ok: false; error: string };

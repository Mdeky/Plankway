export interface GenerateRequest {
  id: number;
  level: number;
  seed: string;
}

export type GenerateResponse =
  | { id: number; ok: true; puzzle: string; solution: number[]; ms: number }
  | { id: number; ok: false; error: string };

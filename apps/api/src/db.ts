/**
 * The subset of Cloudflare D1 that the API uses. Declared here instead of pulling in
 * @cloudflare/workers-types; tests provide the same interface on top of node:sqlite.
 */
export interface D1Result<T> {
  results: T[];
}

export interface D1RunResult {
  meta: { changes: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1RunResult>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface Env {
  DB: D1Database;
  /** Server-side secret mixed into every stored hash. */
  HASH_PEPPER?: string;
}

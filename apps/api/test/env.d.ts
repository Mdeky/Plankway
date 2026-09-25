// Minimal typings for what the tests use from Node and Vite (no @types/node dependency).
declare module 'node:sqlite' {
  interface StatementSync {
    all(...params: unknown[]): Record<string, unknown>[];
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): { changes: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}

declare module '*?raw' {
  const content: string;
  export default content;
}

import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../src/db.ts';

/** D1-compatible wrapper around an in-memory SQLite database, for tests. */
export function createTestDb(migrations: string[]): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  for (const sql of migrations) raw.exec(sql);

  const statement = (sql: string, params: unknown[] = []): D1PreparedStatement & { exec(): unknown } => {
    const stmt = raw.prepare(sql);
    const returns = /^\s*select|returning/i.test(sql);
    return {
      bind: (...values) => statement(sql, values),
      first: async <T>() => (stmt.get(...params) ?? null) as T | null,
      all: async <T>() => ({ results: stmt.all(...params) as T[] }),
      run: async () => ({ meta: { changes: Number(stmt.run(...params).changes) } }),
      exec: () => (returns ? stmt.all(...params) : stmt.run(...params)),
    };
  };

  return {
    raw,
    prepare: (sql) => statement(sql),
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const out = statements.map((s) => (s as ReturnType<typeof statement>).exec());
        raw.exec('COMMIT');
        return out;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

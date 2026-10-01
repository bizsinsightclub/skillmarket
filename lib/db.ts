import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

// 앱 코드가 쓰는 DB 의 전부. 운영은 postgres.js(Supabase), 테스트는 PGlite(메모리 Postgres)가 구현한다.
// 테이블은 전부 app 스키마 — 쿼리에서 app.xxx 로 적는다(풀러 연결에서 search_path 를 믿지 않기 위해).
export type Db = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
};

export async function one<T>(db: Db, sql: string, params?: unknown[]) {
  return (await db.query<T>(sql, params))[0] as T | undefined;
}

// 파라미터 자리표시자($1, $2…)를 쌓아가며 동적 SQL 을 만들 때 쓴다
export class Params {
  values: unknown[] = [];
  add(v: unknown) {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

// 적용 안 된 db/migrations/*.sql 을 이름순으로 실행. 동시에 두 빌드가 돌아도 advisory lock 으로 한 번만.
export async function migrate(db: Db) {
  await db.tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(424242)");
    await t.query("CREATE SCHEMA IF NOT EXISTS app");
    await t.query("CREATE TABLE IF NOT EXISTS app._migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await t.query<{ name: string }>("SELECT name FROM app._migrations")).map((r) => r.name));
    for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await t.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      await t.query("INSERT INTO app._migrations (name) VALUES ($1)", [file]);
    }
  });
}

type Sql = postgres.Sql | postgres.TransactionSql;

function wrap(sql: Sql, inTx: boolean): Db {
  return {
    query: async (text, params = []) => (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as never,
    // 이미 트랜잭션 안이면 그대로 이어서 쓴다(중첩 = 바깥 트랜잭션 하나)
    tx: (fn) => (inTx ? fn(wrap(sql, true)) : ((sql as postgres.Sql).begin((t) => fn(wrap(t, true))) as never)),
  };
}

export function connect(url: string, opts: { max?: number } = {}): Db & { end: () => Promise<void> } {
  // Supabase 풀러(트랜잭션 모드)는 prepared statement 를 못 쓴다
  const sql = postgres(url, { prepare: false, max: opts.max ?? 5, idle_timeout: 20, onnotice: () => {} });
  return { ...wrap(sql, false), end: () => sql.end() };
}

const g = globalThis as unknown as { __db?: Db };

export function getDb(): Db {
  if (!g.__db) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL 환경변수가 필요합니다 (vercel env pull)");
    g.__db = connect(url);
  }
  return g.__db;
}

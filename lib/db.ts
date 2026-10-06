import fs from "node:fs";
import path from "node:path";
import pg from "pg";

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

// 드라이버는 pg(node-postgres). 매개변수 쿼리를 Parse·Bind·Execute·Sync 한 번에 보낸다.
// (postgres.js 는 prepare:false 일 때 형식을 먼저 묻고(왕복 1) 다시 실행해서, 그 사이 함수가 멈추면
//  Supabase 풀러의 DB 연결이 'ClientRead' 로 묶여 풀이 바닥나고 페이지가 멈췄다 — 2026-10-06)
type Runner = pg.Pool | pg.PoolClient;

function wrap(run: Runner, inTx: boolean): Db {
  return {
    query: async (text, params = []) => (await run.query(text, params)).rows as never,
    // 이미 트랜잭션 안이면 그대로 이어서 쓴다(중첩 = 바깥 트랜잭션 하나)
    tx: async (fn) => {
      if (inTx) return fn(wrap(run, true));
      const client = await (run as pg.Pool).connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client, true));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

export function connect(url: string, opts: { max?: number } = {}): Db & { end: () => Promise<void> } {
  // URL 의 sslmode 는 pg 가 인증서 검증(verify-full)으로 읽어 Supabase 인증서에서 실패한다 → 빼고 암호화만(기존 postgres.js 'require' 와 같은 수준)
  // ponytail: 인증서 검증 없음. 필요해지면 Supabase CA 를 ssl.ca 로 고정
  const u = new URL(url);
  const ssl = u.searchParams.has("sslmode") && u.searchParams.get("sslmode") !== "disable" ? { rejectUnauthorized: false } : undefined;
  u.searchParams.delete("sslmode");
  u.searchParams.delete("supa");
  const pool = new pg.Pool({ connectionString: u.toString(), ssl, max: opts.max ?? 5, idleTimeoutMillis: 20_000 });
  pool.on("error", () => {}); // 쉬는 연결이 끊겨도 프로세스를 죽이지 않는다(다음 쿼리가 새로 연결)
  return { ...wrap(pool, false), end: () => pool.end() };
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

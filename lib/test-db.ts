// 테스트 전용: 메모리 Postgres(PGlite)에 마이그레이션을 적용한 Db
import { PGlite } from "@electric-sql/pglite";
import { migrate, type Db } from "./db.ts";

type Q = Pick<PGlite, "query" | "exec">;

function wrap(pg: Q, inTx: boolean): Db {
  return {
    query: async (sql, params = []) =>
      // 파라미터 없는 여러 문장(마이그레이션)은 exec 로
      params.length === 0 && sql.includes(";") ? ((await pg.exec(sql)).at(-1)?.rows ?? []) as never : ((await pg.query(sql, params)).rows as never),
    tx: (fn) => (inTx ? fn(wrap(pg, true)) : (pg as PGlite).transaction((t) => fn(wrap(t as unknown as Q, true)))),
  };
}

export async function testDb(seed?: string) {
  const db = wrap(await PGlite.create(), false);
  await migrate(db);
  if (seed) await db.query(seed);
  return db;
}

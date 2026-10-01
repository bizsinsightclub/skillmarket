// 빌드 전에 실행: DB 마이그레이션 + Storage 버킷 준비. `npm run build` 가 먼저 부른다.
import { connect, migrate } from "../lib/db.ts";
import { ensureBucket } from "../lib/storage.ts";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] POSTGRES_URL 없음 — 건너뜀");
  process.exit(0);
}
const db = connect(url, { max: 1 });
try {
  await migrate(db);
  await ensureBucket();
  console.log("[migrate] 완료");
} finally {
  await db.end();
}

// 스킬 구조도(archify) + 원리 수동 생성. 평소엔 매일 13:00 KST enrich 크론이 승인된 새 버전에 자동으로 만든다.
//   npm run diagram            승인된 버전(+ 승인 전이면 최신) 중 아직 없는 것
//   npm run diagram -- --force 이미 있거나 실패('')한 것도 다시
import { connect } from "../lib/db.ts";
import { makeDiagram } from "../lib/diagram.ts";

const force = process.argv.includes("--force");
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL 없음 — npx vercel env pull 로 .env.local 을 받으세요");
const db = connect(url, { max: 1 });
try {
  const rows = await db.query<{ id: number; name: string }>(
    `SELECT v.id, s.name FROM app.skills s JOIN app.categories c ON c.slug = s.category
     JOIN LATERAL (SELECT id, diagram_path FROM app.skill_versions WHERE skill_id = s.id
                   ORDER BY (id = s.curated_version_id) DESC, id DESC LIMIT 1) v ON true
     WHERE c.post_type = 'skill' ${force ? "" : "AND v.diagram_path IS NULL"} ORDER BY s.id`,
  );
  console.log(`[diagram] 대상 ${rows.length}개`);
  for (const r of rows) {
    const t0 = Date.now();
    const res = await makeDiagram(db, r.id, Date.now() + 15 * 60_000);
    console.log(`  ${res} · ${r.name} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
} finally {
  await db.end();
}

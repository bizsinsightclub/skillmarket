import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { askSkills } from "./ask.ts";
import type { Viewer } from "./queries.ts";

// 키 없이도 동작해야 한다: VOYAGE 없으면 키워드 검색, ANTHROPIC 없으면 설명(answer)=null, 카드(picks)만.
delete process.env.VOYAGE_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com');
  INSERT INTO app.skills (id, slug, name, summary, author_name, author_email, owner_id, visibility) OVERRIDING SYSTEM VALUE VALUES
    (1, 'slides', '슬라이드 메이커', '발표 슬라이드를 빨리', 'A', 'owner@samsung.com', 1, 'public'),
    (2, 'excel', '엑셀 분석기', '데이터 분석', 'A', 'owner@samsung.com', 1, 'public');
  INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES
    (1, 1, '1.0.0', 'x', 'x', 1), (2, 2, '1.0.0', 'x', 'x', 1);
  UPDATE app.skills SET curated_version_id = id, curation_status = 'approved';
`;
const viewer: Viewer = { id: 1, email: "owner@samsung.com", editor: false };

test("askSkills: 키워드로 후보를 찾고, ANTHROPIC 키 없으면 answer=null", async () => {
  const db = await testDb(SEED);
  const res = await askSkills(db, viewer, [{ role: "user", content: "슬라이드" }]);
  assert.equal(res.answer, null);
  assert.ok(res.picks.some((p) => p.slug === "slides"));
  assert.ok(!res.picks.some((p) => p.slug === "excel")); // 질문과 무관한 건 키워드로 안 걸린다
});

test("askSkills: 사용자 질문이 없으면 빈 결과", async () => {
  const db = await testDb(SEED);
  assert.deepEqual(await askSkills(db, viewer, [{ role: "assistant", content: "안녕하세요" }]), { answer: null, picks: [] });
});

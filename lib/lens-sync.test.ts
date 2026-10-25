import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { UploadError } from "./skill-zip.ts";
import { nextVersion, readSyncBody, syncLens, type Store } from "./lens-sync.ts";

const body = "규칙 설명 ".repeat(30);
const lensMd = (step = "PRICE") => `# EXPERT-09: 브랜드 성장 — 샤프의 브랜드 성장 법칙 v1.0

> ⚠ 인물 연기가 아니다.

\`\`\`
# 역할
너는 분석가다. ${body}
# 오퍼레이션 (반드시 이 순서대로)
1단계 — WALK (동선 관찰):
2단계 — ${step} (판정):
# 출력 형식
[진단 한 줄]
\`\`\`
`;
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]).toString("base64");
const owner = { id: 1, name: "에디터", email: "ed@samsung.com" };
const SEED = "INSERT INTO app.users (id, email, name) OVERRIDING SYSTEM VALUE VALUES (1, 'ed@samsung.com', '에디터');";

function fakeStore() {
  const files = new Map<string, Uint8Array>();
  const store: Store = {
    upload: async (path, data) => void files.set(path, data),
    remove: async (paths) => paths.forEach((p) => files.delete(p)),
  };
  return { files, store };
}
const input = (over: Record<string, unknown> = {}) =>
  readSyncBody({ lens_id: "EXPERT-09", md: lensMd(), person: "바이런 샤프", basis: "바이런 샤프의 브랜드 성장 법칙", summary: "한 줄", portrait: JPG, ...over });

test("요청 모양 검사: id 형식·필수 칸·이미지 바이트", () => {
  assert.equal(input().portrait?.ext, "jpg");
  assert.throws(() => input({ lens_id: "../x" }), UploadError);
  assert.throws(() => input({ person: "" }), UploadError);
  assert.throws(() => input({ portrait: Buffer.from("<svg/>").toString("base64") }), UploadError);
  assert.throws(() => readSyncBody([]), UploadError);
  assert.equal(input({ portrait: null }).portrait, null);
});

test("다음 버전: 가장 큰 x.y 다음, 겹치면 더 올린다", () => {
  assert.equal(nextVersion([]), "1.0.0");
  assert.equal(nextVersion(["1.0.0"]), "1.1.0");
  assert.equal(nextVersion(["1.0.0", "1.3.0", "1.2.5"]), "1.4.0");
  assert.equal(nextVersion(["2.0.0", "1.9.0"]), "2.1.0");
  assert.equal(nextVersion(["초판"]), "1.0.0");
});

test("처음엔 글 생성(검수 대기·썸네일), 같은 파일이면 그대로, 바뀌면 새 버전 + 다시 검수 대기", async () => {
  const db = await testDb(SEED);
  const { files, store } = fakeStore();

  const r1 = await syncLens(db, store, owner, input());
  assert.deepEqual([r1.action, r1.slug, r1.version], ["created", "expert-09", "1.0.0"]);
  const s = (await db.query<Record<string, unknown>>("SELECT * FROM app.skills WHERE slug = 'expert-09'"))[0];
  assert.equal(s.name, "브랜드 성장");
  assert.equal(s.category, "expert");
  assert.equal(s.person, "바이런 샤프");
  assert.equal(s.bands, "WALK (동선 관찰),PRICE (판정)");
  assert.equal(s.curation_status, "pending");
  assert.equal(s.lens_source, "EXPERT-09");
  assert.ok(files.has(`skills/${s.id}/versions/1.0.0.md`));
  assert.equal((await db.query("SELECT 1 FROM app.snapshots WHERE skill_id = $1", [s.id])).length, 1);

  // 에디터가 승인한 뒤 같은 파일을 다시 보내면 아무것도 바뀌지 않는다
  await db.query("UPDATE app.skills SET curation_status = 'approved' WHERE id = $1", [s.id]);
  const r2 = await syncLens(db, store, owner, input({ md: lensMd().replace(/\n/g, "\r\n") }));
  assert.equal(r2.action, "unchanged");
  assert.equal((await db.query<{ curation_status: string }>("SELECT curation_status FROM app.skills WHERE id = $1", [s.id]))[0].curation_status, "approved");

  const r3 = await syncLens(db, store, owner, input({ md: lensMd("SHELF") }));
  assert.deepEqual([r3.action, r3.version], ["updated", "1.1.0"]);
  const after = (await db.query<{ curation_status: string; bands: string }>("SELECT curation_status, bands FROM app.skills WHERE id = $1", [s.id]))[0];
  assert.equal(after.curation_status, "pending");
  assert.equal(after.bands, "WALK (동선 관찰),SHELF (판정)");
  assert.equal((await db.query("SELECT 1 FROM app.snapshots WHERE skill_id = $1", [s.id])).length, 1); // 썸네일은 한 번만
});

test("손으로 올려 둔 같은 렌즈(기반 인물 일치, 하나뿐)는 이어받아 새 버전으로", async () => {
  const db = await testDb(SEED + `
    INSERT INTO app.skills (slug, name, summary, body_md, category, tags, author_name, author_email, owner_id, person)
      VALUES ('expert', '브랜드 성장', '', '', 'expert', '', 'x', 'ed@samsung.com', 1, '바이런 샤프');
    INSERT INTO app.skill_versions (skill_id, version, zip_path, skill_md, uploaded_by)
      SELECT id, '1.0.0', 'p', 'old', 1 FROM app.skills WHERE slug = 'expert';`);
  const r = await syncLens(db, fakeStore().store, owner, input());
  assert.deepEqual([r.action, r.slug, r.version], ["updated", "expert", "1.1.0"]);
  assert.equal((await db.query("SELECT 1 FROM app.skills")).length, 1);
});

test("잘못된 렌즈 파일은 거부하고 올린 파일을 남기지 않는다", async () => {
  const db = await testDb(SEED);
  const { files, store } = fakeStore();
  await assert.rejects(syncLens(db, store, owner, input({ md: "# 제목\n\n코드블록 없음" })), UploadError);
  assert.equal(files.size, 0);
  assert.equal((await db.query("SELECT 1 FROM app.skills")).length, 0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { one } from "./db.ts";
import { review, pick, unpick, revoke, autoRequest, CurationError } from "./curation.ts";

const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com'), (9, 'editor@samsung.com');
  INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, curation_status) OVERRIDING SYSTEM VALUE VALUES
    (1, 'a', 'A', 'A', 'owner@samsung.com', 1, 'pending'), (2, 'b', 'B', 'B', 'owner@samsung.com', 1, 'none');
  INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES
    (10, 1, '1.0', 'x', 'x', 1), (20, 2, '1.0', 'x', 'x', 1);
`;
const V2 = "INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES (11, 1, '2.0', 'x', 'x', 1)";

async function setup() {
  const db = await testDb(SEED);
  const row = async () =>
    one<{ curation_status: string; curated_version_id: number | null; picked: boolean }>(db, "SELECT curation_status, curated_version_id, picked_at IS NOT NULL AS picked FROM app.skills WHERE id = 1");
  return { db, row };
}

test("승인은 검토한 버전으로 고정되고 이후 새 버전은 들어가지 않음, 승인만으로 에디터 픽은 아님", async () => {
  const { db, row } = await setup();
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  await db.query(V2);
  assert.deepEqual(await row(), { curation_status: "approved", curated_version_id: 10, picked: false });
});

test("재검수 반려돼도 이전 승인 버전 유지, 반려는 사유 필수", async () => {
  const { db, row } = await setup();
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  await db.query(V2);
  await assert.rejects(review(db, { skillId: 1, versionId: 11, editorId: 9, decision: "rejected", note: " " }), CurationError);
  await review(db, { skillId: 1, versionId: 11, editorId: 9, decision: "rejected", note: "설명 부족" });
  assert.deepEqual(await row(), { curation_status: "rejected", curated_version_id: 10, picked: false });
});

test("다른 스킬의 버전으로는 승인 불가", async () => {
  const { db, row } = await setup();
  await assert.rejects(review(db, { skillId: 1, versionId: 20, editorId: 9, decision: "approved", note: "" }), CurationError);
  assert.deepEqual(await row(), { curation_status: "pending", curated_version_id: null, picked: false });
});

test("에디터 픽은 승인된 글만 고를 수 있고, 승인 취소하면 픽도 함께 내려감", async () => {
  const { db, row } = await setup();
  await assert.rejects(pick(db, 1), CurationError);
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  await pick(db, 1);
  assert.equal((await row())!.picked, true);
  await unpick(db, 1);
  assert.deepEqual(await row(), { curation_status: "approved", curated_version_id: 10, picked: false });
  await pick(db, 1);
  await revoke(db, 1);
  assert.deepEqual(await row(), { curation_status: "none", curated_version_id: null, picked: false });
});

test("공개 중인 그 버전을 반려하면 승인 취소와 같다, 새 버전 반려는 이전 승인 유지", async () => {
  const { db, row } = await setup();
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  await pick(db, 1);
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "rejected", note: "문제 발견" });
  assert.deepEqual(await row(), { curation_status: "rejected", curated_version_id: null, picked: false });
});

test("검토하는 사이 새 버전이 올라오면 승인 뒤에도 대기함에 남는다", async () => {
  const { db, row } = await setup();
  await db.query(V2); // 에디터는 v1(10)을 보고 있었다
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  assert.deepEqual(await row(), { curation_status: "pending", curated_version_id: 10, picked: false });
});

test("자동 검수 요청: 전사 공개·링크형 아님·최신 버전이 승인 전일 때만", async () => {
  const { db } = await setup();
  const status = async (id: number) => (await one<{ s: string }>(db, "SELECT curation_status AS s FROM app.skills WHERE id = $1", [id]))!.s;
  await autoRequest(db, 2);
  assert.equal(await status(2), "pending");
  await review(db, { skillId: 2, versionId: 20, editorId: 9, decision: "approved", note: "" });
  await autoRequest(db, 2); // 최신이 승인 버전 → 그대로
  assert.equal(await status(2), "approved");
  await db.query("INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES (21, 2, '2.0', 'x', 'x', 1)");
  await autoRequest(db, 2); // 새 버전 → 다시 대기
  assert.equal(await status(2), "pending");
  await db.query("UPDATE app.skills SET visibility = 'restricted', curation_status = 'none' WHERE id = 2");
  await autoRequest(db, 2); // 지정 공개는 검수 필수 아님
  assert.equal(await status(2), "none");
  await db.query("UPDATE app.skills SET visibility = 'public', category = 'plugin' WHERE id = 2");
  await autoRequest(db, 2); // 링크형도 아님
  assert.equal(await status(2), "none");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { one } from "./db.ts";
import { review, setPick, uncurate, CurationError } from "./curation.ts";

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
  const row = async () => one(db, "SELECT curation_status, curated_version_id, editor_pick FROM app.skills WHERE id = 1");
  return { db, row };
}

test("승인은 검토한 버전으로 고정, 이후 새 버전은 큐레이티드에 안 들어감", async () => {
  const { db, row } = await setup();
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  await db.query(V2);
  assert.deepEqual(await row(), { curation_status: "approved", curated_version_id: 10, editor_pick: false });
});

test("재검수 반려돼도 이전 승인 버전 유지, 반려는 사유 필수", async () => {
  const { db, row } = await setup();
  await review(db, { skillId: 1, versionId: 10, editorId: 9, decision: "approved", note: "" });
  await db.query(V2);
  await assert.rejects(review(db, { skillId: 1, versionId: 11, editorId: 9, decision: "rejected", note: " " }), CurationError);
  await review(db, { skillId: 1, versionId: 11, editorId: 9, decision: "rejected", note: "설명 부족" });
  assert.deepEqual(await row(), { curation_status: "rejected", curated_version_id: 10, editor_pick: false });
});

test("다른 스킬의 버전으로는 승인 불가", async () => {
  const { db, row } = await setup();
  await assert.rejects(review(db, { skillId: 1, versionId: 20, editorId: 9, decision: "approved", note: "" }), CurationError);
  assert.deepEqual(await row(), { curation_status: "pending", curated_version_id: null, editor_pick: false });
});

test("에디터 픽: 큐레이티드 아니면 함께 승인, 해제하면 모두 초기화", async () => {
  const { db, row } = await setup();
  await setPick(db, { skillId: 1, versionId: 10, editorId: 9, on: true });
  assert.deepEqual(await row(), { curation_status: "approved", curated_version_id: 10, editor_pick: true });
  await setPick(db, { skillId: 1, versionId: 10, editorId: 9, on: false });
  assert.deepEqual(await row(), { curation_status: "approved", curated_version_id: 10, editor_pick: false });
  await uncurate(db, 1);
  assert.deepEqual(await row(), { curation_status: "none", curated_version_id: null, editor_pick: false });
});

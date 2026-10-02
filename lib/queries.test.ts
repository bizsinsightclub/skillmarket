import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { listBoard, getSkill, authorStats, type Viewer, type Tab } from "./queries.ts";
import type { Db } from "./db.ts";

const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com'), (2, 'friend@cheil.com'), (3, 'other@samsung.com');
  INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, visibility) OVERRIDING SYSTEM VALUE VALUES
    (1, 'pub', '공개 스킬', 'A', 'owner@samsung.com', 1, 'public'),
    (2, 'sec', '비공개 스킬', 'A', 'owner@samsung.com', 1, 'restricted');
  INSERT INTO app.skill_access (skill_id, email) VALUES (2, 'friend@cheil.com');
  INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES
    (1, 1, '1.0.0', 'x', 'x', 1), (2, 2, '1.0.0', 'x', 'x', 1);
`;

const owner: Viewer = { id: 1, email: "owner@samsung.com", editor: false };
const friend: Viewer = { id: 2, email: "friend@cheil.com", editor: false };
const other: Viewer = { id: 3, email: "other@samsung.com", editor: false };

const slugs = async (db: Db, v: Viewer, tab?: Tab) => (await listBoard(db, v, { tab })).rows.map((r) => r.slug).sort();

test("비공개 스킬: 소유자·허용 이메일·에디터만 목록에서 보임", async () => {
  const db = await testDb(SEED);
  assert.deepEqual(await slugs(db, owner), ["pub", "sec"]);
  assert.deepEqual(await slugs(db, friend), ["pub", "sec"]);
  assert.deepEqual(await slugs(db, other), ["pub"]);
  assert.deepEqual(await slugs(db, { ...other, editor: true }), ["pub", "sec"]);
  assert.equal((await listBoard(db, other)).total, 1);
});

test("에디터 픽 탭: 승인된 공개 글만, 비공개는 승인돼도 제외", async () => {
  const db = await testDb(SEED);
  assert.deepEqual(await slugs(db, owner, "pick"), []);
  await db.query("UPDATE app.skills SET curation_status = 'approved', curated_version_id = id");
  assert.deepEqual(await slugs(db, owner, "pick"), ["pub"]);
});

test("스킬과 링크형(플러그인·MCP)은 따로 나온다", async () => {
  const db = await testDb(SEED);
  await db.query(`INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, category, maker, install_cmd) OVERRIDING SYSTEM VALUE
                  VALUES (3, 'plug', '플러그인', 'A', 'owner@samsung.com', 1, 'plugin', 'X', '/plugin install x')`);
  const kinds = async (kind: "skill" | "link") => (await listBoard(db, other, { kind })).rows.map((r) => r.slug).sort();
  assert.deepEqual(await kinds("skill"), ["pub"]);
  assert.deepEqual(await kinds("link"), ["plug"]);
  assert.equal((await listBoard(db, other, { kind: "link" })).total, 1);
});

test("검색어의 % _ 는 문자 그대로, 대소문자 무시", async () => {
  const db = await testDb(SEED);
  assert.equal((await listBoard(db, other, { q: "%" })).total, 0);
  assert.equal((await listBoard(db, other, { q: "공개" })).total, 1);
});

test("단건 조회·원작자 합계도 같은 가시성 규칙", async () => {
  const db = await testDb(SEED);
  assert.equal(await getSkill(db, other, { slug: "sec" }), undefined);
  assert.equal(await getSkill(db, other, { id: 2 }), undefined);
  assert.equal((await getSkill(db, friend, { slug: "sec" }))?.id, 2);
  assert.equal((await authorStats(db, other, "owner@samsung.com")).skills, 1);
  assert.equal((await authorStats(db, friend, "owner@samsung.com")).skills, 2);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import {
  listBoard, getSkill, authorStats, listNotices, unreadNotices, skillStats, myContribution, hallOfFame, pickVersion, listVersions, versionParam, type Viewer, type Tab,
} from "./queries.ts";
import type { Db } from "./db.ts";

const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com'), (2, 'friend@cheil.com'), (3, 'other@samsung.com');
  INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, visibility) OVERRIDING SYSTEM VALUE VALUES
    (1, 'pub', '공개 스킬', 'A', 'owner@samsung.com', 1, 'public'),
    (2, 'sec', '비공개 스킬', 'A', 'owner@samsung.com', 1, 'restricted');
  INSERT INTO app.skill_access (skill_id, email) VALUES (2, 'friend@cheil.com');
  INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES
    (1, 1, '1.0.0', 'x', 'x', 1), (2, 2, '1.0.0', 'x', 'x', 1);
  UPDATE app.skills SET curated_version_id = 1, curation_status = 'approved' WHERE id = 1; -- 전사 공개 글은 승인돼야 남에게 보인다
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

test("에디터 픽 탭: 승인 후 에디터가 고른 공개 글만, 비공개는 골라도 제외", async () => {
  const db = await testDb(SEED);
  assert.deepEqual(await slugs(db, owner, "pick"), []); // 승인만으로는 에디터 픽이 아니다
  await db.query("UPDATE app.skills SET curation_status = 'approved', curated_version_id = id, picked_at = now()");
  assert.deepEqual(await slugs(db, owner, "pick"), ["pub"]);
  await db.query("UPDATE app.skills SET curated_version_id = NULL WHERE id = 1"); // 승인 취소되면 픽도 무효
  assert.deepEqual(await slugs(db, owner, "pick"), []);
});

test("검수 필수: 승인 전 전사 공개 글은 올린 사람·원작자·에디터만, 링크형·지정 공개는 검수 없이", async () => {
  const db = await testDb(SEED);
  await db.query(`INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, category, maker, install_cmd) OVERRIDING SYSTEM VALUE VALUES
    (3, 'new', '새 스킬', 'F', 'friend@cheil.com', 1, 'etc', '', ''),
    (4, 'plug', '플러그인', 'A', 'owner@samsung.com', 1, 'plugin', 'X', '/plugin install x')`);
  assert.deepEqual(await slugs(db, other), ["plug", "pub"]);
  assert.deepEqual(await slugs(db, owner), ["new", "plug", "pub", "sec"]);
  assert.deepEqual(await slugs(db, friend), ["new", "plug", "pub", "sec"]); // 원작자로 적힌 사람 + 지정 공개 대상
  assert.deepEqual(await slugs(db, { ...other, editor: true }), ["new", "plug", "pub", "sec"]);
  assert.equal(await getSkill(db, other, { slug: "new" }), undefined);
});

test("설치 수 = 받아 간 사람 수: 같은 사람 여러 번은 한 번, 올린 사람·원작자 본인은 제외", async () => {
  const db = await testDb(SEED);
  await db.query("UPDATE app.skills SET author_email = 'friend@cheil.com' WHERE id = 1"); // 올린 사람 1, 원작자 2
  await db.query(`INSERT INTO app.installs (skill_id, version_id, user_id) VALUES (1, 1, 1), (1, 1, 2), (1, 1, 3), (1, 1, 3), (1, 1, 3)`);
  await db.query("INSERT INTO app.uses (user_id, skill_id) VALUES (1, 1), (3, 1)");
  const row = (await listBoard(db, other)).rows.find((r) => r.slug === "pub")!;
  assert.equal(row.installs, 1);
  assert.equal(row.trend, 1);
  const stats = await skillStats(db, 1, 3);
  assert.deepEqual([stats.installs, stats.uses, stats.used], [1, 1, true]);
  assert.deepEqual(await myContribution(db, "friend@cheil.com"), { skills: 1, waiting: 0, recs: 0, likes: 0, installs: 1, month: 1, uses: 1 });
  assert.deepEqual((await hallOfFame(db)).map((h) => [h.author_email, h.installs, h.uses]), [["friend@cheil.com", 1, 1]]);
});

test("받을 버전: 남은 승인된 버전만(?v 로 승인 전 버전 요청해도 안 됨), 올린 사람은 최신도", async () => {
  const db = await testDb(SEED);
  await db.query("INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES (3, 1, '2.0.0', 'y', 'y', 1)");
  const skill = (await getSkill(db, other, { slug: "pub" }))!;
  assert.equal((await pickVersion(db, other, skill, null))?.id, 1);
  assert.equal(await pickVersion(db, other, skill, 3), undefined);
  assert.equal((await pickVersion(db, owner, skill, 3))?.id, 3);
  assert.equal((await pickVersion(db, owner, skill, null))?.id, 1); // 기본은 승인 버전
  assert.deepEqual((await listVersions(db, 1)).map((v) => [v.id, v.approved]), [[3, false], [1, true]]);
  await db.query("INSERT INTO app.curation_reviews (skill_id, version_id, editor_id, decision) VALUES (1, 1, 3, 'approved'), (1, 3, 3, 'approved')");
  await db.query("UPDATE app.skills SET curated_version_id = 3 WHERE id = 1");
  assert.equal((await pickVersion(db, other, skill, null))?.id, 3);
  assert.equal((await pickVersion(db, other, skill, 1))?.id, 1); // 예전에 검수 승인된 버전은 계속 받을 수 있다
  assert.equal(await pickVersion(db, other, skill, NaN), undefined); // ?v=1.5 같은 값
  // 승인 취소 → 다시 승인: 취소 전에 승인됐던 옛 버전은 더 못 받는다
  await db.query("UPDATE app.skills SET curated_version_id = NULL, revoked_at = now() + interval '1 second' WHERE id = 1");
  await db.query("INSERT INTO app.curation_reviews (skill_id, version_id, editor_id, decision, created_at) VALUES (1, 3, 3, 'approved', now() + interval '2 seconds')");
  await db.query("UPDATE app.skills SET curated_version_id = 3 WHERE id = 1");
  assert.equal(await pickVersion(db, other, skill, 1), undefined);
  assert.equal((await pickVersion(db, other, skill, 3))?.id, 3);
});

test("?v= 값 읽기: 없으면 null, 정수가 아니거나 범위 밖이면 NaN", () => {
  assert.equal(versionParam("http://x/a"), null);
  assert.equal(versionParam("http://x/a?v=12"), 12);
  assert.ok(Number.isNaN(versionParam("http://x/a?v=1.5")!));
  assert.ok(Number.isNaN(versionParam("http://x/a?v=99999999999")!));
});

test("알림함: 받아 감(사람당 한 번)·써봤어요·에디터 픽은 올린 사람과 원작자 모두에게, 원작자 확인 요청은 원작자에게", async () => {
  const db = await testDb(SEED);
  await db.query("UPDATE app.skills SET author_email = 'friend@cheil.com', author_confirmed = NULL, picked_at = now() WHERE id = 1");
  await db.query("INSERT INTO app.installs (skill_id, version_id, user_id) VALUES (1, 1, 3), (1, 1, 3), (1, 1, 1)");
  await db.query("INSERT INTO app.uses (user_id, skill_id) VALUES (3, 1)");
  assert.deepEqual((await listNotices(db, 1)).map((x) => x.kind).sort(), ["install", "pick", "use"]);
  assert.deepEqual((await listNotices(db, 2)).map((x) => x.kind).sort(), ["author", "install", "pick", "use"]);
  assert.deepEqual((await listNotices(db, 3)).map((x) => x.kind), []);
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

test("의미 검색: 임베딩 코사인으로 정렬·관련 낮으면 제외, 임베딩 없으면 키워드 폴백", async () => {
  const db = await testDb(SEED);
  await db.query(`INSERT INTO app.skills (id, slug, name, summary, author_name, author_email, owner_id, visibility, curation_status)
    OVERRIDING SYSTEM VALUE VALUES (3,'deck','웹슬라이드','발표자료','A','owner@samsung.com',1,'public','approved')`);
  await db.query(`INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES (3,3,'1.0','x','x',1)`);
  await db.query("UPDATE app.skills SET curated_version_id = 3 WHERE id = 3");
  await db.query("UPDATE app.skills SET embedding = '{1,0}' WHERE id = 1"); // pub
  await db.query("UPDATE app.skills SET embedding = '{0,1}' WHERE id = 3"); // deck

  // 쿼리 벡터 [0,1] → deck(코사인 1)만, pub(코사인 0 < 0.35)은 제외 — '슬라이드' 글자가 없어도 의미로 잡힘
  assert.deepEqual((await listBoard(db, other, { q: "발표자료 만들기", queryEmbedding: [0, 1] })).rows.map((r) => r.slug), ["deck"]);
  // 임베딩이 전혀 없으면(백필 전) 키워드로 폴백
  await db.query("UPDATE app.skills SET embedding = NULL");
  assert.deepEqual((await listBoard(db, other, { q: "발표", queryEmbedding: [0, 1] })).rows.map((r) => r.slug), ["deck"]);
});

test("단건 조회·원작자 합계도 같은 가시성 규칙", async () => {
  const db = await testDb(SEED);
  assert.equal(await getSkill(db, other, { slug: "sec" }), undefined);
  assert.equal(await getSkill(db, other, { id: 2 }), undefined);
  assert.equal((await getSkill(db, friend, { slug: "sec" }))?.id, 2);
  assert.equal((await authorStats(db, other, "owner@samsung.com")).made, 1);
  assert.equal((await authorStats(db, friend, "owner@samsung.com")).made, 2);
});

test("추천한 글(외부 플러그인·오픈소스, 웹에서 가져온 스킬)은 만든 글로 세지 않는다", async () => {
  const db = await testDb(SEED);
  await db.query(`INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, category, maker, install_cmd, curation_status) OVERRIDING SYSTEM VALUE
                  VALUES (3, 'plug', '플러그인', 'A', 'owner@samsung.com', 1, 'plugin', 'Anthropic', '/plugin install x', 'pending')`);
  // 웹에서 가져온 공개 스킬(zip): 만든 곳이 있으면 추천한 글
  await db.query(`INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id, maker, homepage_url) OVERRIDING SYSTEM VALUE
                  VALUES (4, 'ext', '가져온 스킬', 'A', 'owner@samsung.com', 1, 'Anthropic', 'https://github.com/anthropics/skills')`);
  await db.query("INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES (4, 4, '1.0.0', 'x', 'x', 1)");
  await db.query("UPDATE app.skills SET curated_version_id = 4 WHERE id = 4");
  await db.query("INSERT INTO app.likes (user_id, skill_id) VALUES (3, 3), (3, 4)");
  const s = await authorStats(db, other, "owner@samsung.com");
  assert.deepEqual([s.made, s.recs, s.likes], [1, 2, 0]);
  assert.deepEqual((await listBoard(db, other, { author: "owner@samsung.com", made: true })).rows.map((r) => r.slug), ["pub"]);
  assert.deepEqual((await listBoard(db, other, { author: "owner@samsung.com", made: false })).rows.map((r) => r.slug).sort(), ["ext", "plug"]);
  const mine = await myContribution(db, "owner@samsung.com");
  assert.deepEqual([mine.skills, mine.recs, mine.waiting, mine.likes], [1, 2, 0, 0]); // 링크형 검수 대기는 내 기여의 '검수 대기'가 아니다
});

test("알림함: 내 글에 대한 남의 검수·좋아요만, 안 읽은 수는 마지막으로 연 뒤부터", async () => {
  const db = await testDb(SEED);
  await db.query("UPDATE app.users SET inbox_seen_at = now() - interval '1 day' WHERE id = 1");
  await db.query("INSERT INTO app.likes (user_id, skill_id) VALUES (2, 1), (1, 1)"); // 1번(본인) 좋아요는 알림 아님
  await db.query("INSERT INTO app.curation_reviews (skill_id, version_id, editor_id, decision, note) VALUES (1, 1, 3, 'rejected', '설명 부족')");
  const n = await listNotices(db, 1);
  assert.deepEqual(n.map((x) => x.kind).sort(), ["like", "review"]);
  assert.equal(n.find((x) => x.kind === "review")?.note, "설명 부족");
  assert.equal(await unreadNotices(db, 1), 2);
  await db.query("UPDATE app.users SET inbox_seen_at = now() WHERE id = 1");
  assert.equal(await unreadNotices(db, 1), 0);
  assert.equal((await listNotices(db, 2)).length, 0); // 남의 글 알림은 안 보임
});

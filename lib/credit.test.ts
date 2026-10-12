import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { one, type Db } from "./db.ts";
import { recordAuthor, confirmAuthor, report, resolveReport, CreditError, MAX_AUTHOR_MAILS_PER_DAY, MAX_AUTHOR_MAILS_GLOBAL_DAY } from "./credit.ts";

const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'up@samsung.com'), (2, 'maker@cheil.com'), (9, 'editor@samsung.com');
  INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id) OVERRIDING SYSTEM VALUE VALUES (1, 'a', 'A', '메이커', 'maker@cheil.com', 1);
`;
const up = { id: 1, email: "up@samsung.com" };
const maker = { id: 2, email: "maker@cheil.com" };
const confirmed = async (db: Db) => (await one<{ c: boolean | null }>(db, "SELECT author_confirmed AS c FROM app.skills WHERE id = 1"))!.c;
const history = async (db: Db) =>
  (await db.query<{ author_email: string; changed_by: number }>("SELECT author_email, changed_by FROM app.author_history WHERE skill_id = 1 ORDER BY id")).map((h) => [h.author_email, h.changed_by]);

test("남을 원작자로 적으면 확인 대기 + 메일, 본인이 적으면 확인됨, 같은 값이면 기록 안 함", async () => {
  const db = await testDb(SEED);
  assert.equal(await recordAuthor(db, { skillId: 1, name: "메이커", email: "maker@cheil.com", by: up }), true);
  assert.equal(await confirmed(db), null);
  assert.equal(await recordAuthor(db, { skillId: 1, name: "메이커", email: "maker@cheil.com", by: up }), false);
  assert.equal(await recordAuthor(db, { skillId: 1, name: "메이커님", email: "maker@cheil.com", by: up }), false); // 이름만: 상태 유지
  assert.equal(await confirmed(db), null);
  assert.equal(await recordAuthor(db, { skillId: 1, name: "나", email: "up@samsung.com", by: up }), false);
  assert.equal(await confirmed(db), true);
  assert.deepEqual(await history(db), [["maker@cheil.com", 1], ["maker@cheil.com", 1], ["up@samsung.com", 1]]);
});

test("같은 사람에게 가는 확인 메일은 하루 한도까지 — 글을 지웠다 다시 올려도 줄지 않는다", async () => {
  const db = await testDb(SEED);
  const sent: boolean[] = [];
  for (let i = 2; i < 3 + MAX_AUTHOR_MAILS_PER_DAY; i++) {
    await db.query(`INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id) OVERRIDING SYSTEM VALUE VALUES (${i}, 's${i}', 'S', 'M', 'maker@cheil.com', 1)`);
    sent.push(await recordAuthor(db, { skillId: i, name: "M", email: "maker@cheil.com", by: up }));
    await db.query(`DELETE FROM app.skills WHERE id = ${i}`);
  }
  assert.deepEqual(sent, [...Array(MAX_AUTHOR_MAILS_PER_DAY).fill(true), false]);
});

test("전체 하루 한도, 링크형 추천인은 확인 절차 없음", async () => {
  const db = await testDb(SEED);
  await db.query(`INSERT INTO app.mail_log (kind, email) SELECT 'author', 'x' || g || '@samsung.com' FROM generate_series(1, ${MAX_AUTHOR_MAILS_GLOBAL_DAY}) g`);
  assert.equal(await recordAuthor(db, { skillId: 1, name: "메이커", email: "maker@cheil.com", by: up }), false);
  assert.equal(await confirmed(db), null); // 메일은 못 보내도 확인 대기(알림함으로)
  await db.query("DELETE FROM app.author_history");
  assert.equal(await recordAuthor(db, { skillId: 1, name: "메이커", email: "maker@cheil.com", by: up, isLink: true }), false);
  assert.equal(await confirmed(db), true);
});

test("원작자 확인: 본인만, 대기 중일 때만. '제가 아니에요'는 출처 신고로", async () => {
  const db = await testDb(SEED);
  await recordAuthor(db, { skillId: 1, name: "메이커", email: "maker@cheil.com", by: up });
  await assert.rejects(confirmAuthor(db, { skillId: 1, user: up, yes: true }), CreditError);
  await confirmAuthor(db, { skillId: 1, user: maker, yes: false });
  assert.equal(await confirmed(db), false);
  await assert.rejects(confirmAuthor(db, { skillId: 1, user: maker, yes: true }), CreditError); // 이미 답함
  assert.equal((await one<{ n: number }>(db, "SELECT COUNT(*)::int AS n FROM app.reports WHERE skill_id = 1 AND reporter_id = 2 AND resolved_at IS NULL"))!.n, 1);
});

test("출처 신고: 사유 필수, 한 사람이 열린 신고는 하나, 처리하면 다시 신고 가능", async () => {
  const db = await testDb(SEED);
  await assert.rejects(report(db, { skillId: 1, reporterId: 2, reason: "  " }), CreditError);
  await report(db, { skillId: 1, reporterId: 2, reason: "제가 만든 것입니다" });
  await assert.rejects(report(db, { skillId: 1, reporterId: 2, reason: "또" }), CreditError);
  const id = (await one<{ id: number }>(db, "SELECT id FROM app.reports"))!.id;
  await assert.rejects(resolveReport(db, { reportId: id, editorId: 9, note: "" }), CreditError);
  await resolveReport(db, { reportId: id, editorId: 9, note: "원작자를 고쳤습니다" });
  await assert.rejects(resolveReport(db, { reportId: id, editorId: 9, note: "또" }), CreditError); // 이미 처리됨
  await assert.rejects(resolveReport(db, { reportId: NaN, editorId: 9, note: "x" }), CreditError);
  await report(db, { skillId: 1, reporterId: 2, reason: "다시" });
});

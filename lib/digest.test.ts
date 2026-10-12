import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { lastMonthKst, sendDigests, digestText } from "./digest.ts";

test("지난달 범위는 KST 기준", () => {
  // KST 2026-11-01 09:00 = UTC 00:00
  const { start, end, label } = lastMonthKst(new Date("2026-11-01T00:00:00Z"));
  assert.equal(label, "2026-10");
  assert.equal(start.toISOString(), "2026-09-30T15:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-31T15:00:00.000Z");
  assert.equal(lastMonthKst(new Date("2026-01-15T00:00:00Z")).label, "2025-12");
});

test("지난달 활동이 있는 사내 원작자에게만, 같은 달엔 한 번만", async () => {
  const db = await testDb(`
    INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'a@samsung.com'), (2, 'b@cheil.com'), (3, 'c@samsung.com');
    INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id) OVERRIDING SYSTEM VALUE VALUES
      (1, 'x', 'X', '에이', 'a@samsung.com', 1), (2, 'y', 'Y', '외부', 'ext@gmail.com', 1), (3, 'z', 'Z', '에이', 'a@samsung.com', 1);
    INSERT INTO app.skill_versions (id, skill_id, version, zip_path, skill_md, uploaded_by) OVERRIDING SYSTEM VALUE VALUES
      (1, 1, '1', 'p', 'm', 1), (2, 2, '1', 'p', 'm', 1), (3, 3, '1', 'p', 'm', 1);
    UPDATE app.skills SET curated_version_id = id;
    INSERT INTO app.installs (skill_id, version_id, user_id, created_at) VALUES
      (1, 1, 2, '2026-10-10'), (1, 1, 2, '2026-10-11'), (1, 1, 3, '2026-10-12'), (2, 2, 2, '2026-10-10'), (3, 3, 2, '2026-09-10');
  `);
  const now = new Date("2026-11-01T00:00:00Z");
  const mails: string[] = [];
  let fail = true;
  const send = async ({ email, rows }: { email: string; rows: Parameters<typeof digestText>[0] }, label: string) => {
    if (fail) throw new Error("smtp down");
    mails.push(`${email} ${digestText(rows, label, "https://s").subject}`);
  };
  assert.deepEqual(await sendDigests(db, send, now), { month: "2026-10", waiting: 1, sent: 0 }); // 실패하면 풀어 둔다
  fail = false;
  assert.deepEqual(await sendDigests(db, send, now), { month: "2026-10", waiting: 1, sent: 1 });
  assert.deepEqual(await sendDigests(db, send, now), { month: "2026-10", waiting: 0, sent: 0 }); // 같은 달 두 번은 없다
  assert.deepEqual(mails, ["a@samsung.com [스킬마켓] 2026-10 내 스킬을 동료 2명이 받아 갔습니다"]);
});

import { one, type Db } from "./db.ts";

export class CreditError extends Error {}

// 원작자 확인 메일 한도(하루): 같은 사람에게 3통, 전체 30통. 넘으면 알림함으로만.
// 기록은 mail_log — 글을 지웠다 다시 올려도 줄지 않고, Gmail 하루 한도(약 500)에서 로그인 메일(400) 몫을 지킨다.
export const MAX_AUTHOR_MAILS_PER_DAY = 3;
export const MAX_AUTHOR_MAILS_GLOBAL_DAY = 30;

// 원작자 기록: 등록·변경 때마다 이력을 남긴다(바꿀 수는 있되 기록은 지우지 않는다).
// 원작자 이메일이 바뀌면 확인 상태를 다시 정한다 — 원작자 본인이 적었으면 확인됨, 남이 적었으면 확인 대기.
// 링크형·외부 제작물(isLink)의 크레딧은 '추천인'이라 확인 절차 없이 확인됨.
// 반환값 = 원작자에게 확인 메일을 보낼지(보낼 몫을 mail_log 에 미리 잡는다). 트랜잭션 안에서 부르고, 메일은 커밋 뒤에 보낸다.
export async function recordAuthor(db: Db, p: { skillId: number; name: string; email: string; by: { id: number; email: string }; isLink?: boolean }) {
  const cur = await one<{ author_name: string; author_email: string }>(
    db, "SELECT author_name, author_email FROM app.author_history WHERE skill_id = $1 ORDER BY id DESC LIMIT 1", [p.skillId],
  );
  if (cur && cur.author_name === p.name && cur.author_email === p.email) return false;
  await db.query("INSERT INTO app.author_history (skill_id, author_name, author_email, changed_by) VALUES ($1, $2, $3, $4)", [
    p.skillId, p.name, p.email, p.by.id,
  ]);
  if (cur && cur.author_email === p.email) return false; // 이름만 고침: 확인 상태 유지
  const self = p.isLink || p.email === p.by.email;
  await db.query("UPDATE app.skills SET author_confirmed = $2 WHERE id = $1", [p.skillId, self ? true : null]);
  if (self) return false;
  const sent = (await one<{ me: number; all: number }>(
    db,
    `SELECT COUNT(*) FILTER (WHERE email = $1)::int AS me, COUNT(*)::int AS all
     FROM app.mail_log WHERE kind = 'author' AND created_at > now() - interval '1 day'`,
    [p.email],
  ))!;
  if (sent.me >= MAX_AUTHOR_MAILS_PER_DAY || sent.all >= MAX_AUTHOR_MAILS_GLOBAL_DAY) return false;
  await db.query("INSERT INTO app.mail_log (kind, email) VALUES ('author', $1)", [p.email]);
  return true;
}

// 원작자로 적힌 본인이 확인하거나("맞아요") 부인한다("제가 아니에요" → 출처 신고로 에디터에게).
export async function confirmAuthor(db: Db, p: { skillId: number; user: { id: number; email: string }; yes: boolean }) {
  await db.tx(async (t) => {
    const done = await t.query(
      "UPDATE app.skills SET author_confirmed = $3 WHERE id = $1 AND author_email = $2 AND author_confirmed IS NULL RETURNING 1",
      [p.skillId, p.user.email, p.yes],
    );
    if (!done.length) throw new CreditError("원작자로 적힌 본인만, 확인 대기 중일 때 답할 수 있습니다");
    if (!p.yes) {
      await t.query("INSERT INTO app.reports (skill_id, reporter_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [
        p.skillId, p.user.id, "원작자로 적힌 본인이 '제가 아니에요'라고 답했습니다.",
      ]);
    }
  });
}

// 출처 신고: 한 사람이 한 글에 열린 신고는 하나(DB 부분 고유 인덱스)
export async function report(db: Db, p: { skillId: number; reporterId: number; reason: string }) {
  const reason = p.reason.trim().slice(0, 2000);
  if (!reason) throw new CreditError("신고 사유를 입력하세요");
  const done = await db.query("INSERT INTO app.reports (skill_id, reporter_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1", [
    p.skillId, p.reporterId, reason,
  ]);
  if (!done.length) throw new CreditError("이미 신고한 글입니다. 에디터가 처리하면 알림함으로 알려 드립니다");
}

export async function resolveReport(db: Db, p: { reportId: number; editorId: number; note: string }) {
  const note = p.note.trim().slice(0, 2000);
  if (!note) throw new CreditError("처리 내용을 입력하세요");
  if (!Number.isSafeInteger(p.reportId) || p.reportId <= 0 || p.reportId > 2 ** 31 - 1) throw new CreditError("신고를 찾을 수 없습니다");
  const done = await db.query("UPDATE app.reports SET resolved_at = now(), resolved_by = $2, resolution = $3 WHERE id = $1 AND resolved_at IS NULL RETURNING 1", [
    p.reportId, p.editorId, note,
  ]);
  if (!done.length) throw new CreditError("이미 처리됐거나 없는 신고입니다");
}

import type { Db } from "./db.ts";
import { normalizeEmail } from "./login.ts";
import { monthlyActivity } from "./queries.ts";

// 월간 기여 메일: 지난달(KST) 내 스킬을 받아 가거나 써본 사람이 있으면 원작자에게 한 통.
// 같은 달·같은 사람에게는 한 번만(digest_sent). 사내 메일 주소에만 보낸다.
// Gmail 하루 한도(약 500) = 로그인 메일 400 + 원작자 확인 30 + 월간 메일 60. Cron 이 매달 1~7일 매일 불러 나눠 보낸다(최대 420명).
// ponytail: 원작자가 이보다 많아지면 Resend 로
export const MAX_DIGESTS_PER_RUN = 60;

export function lastMonthKst(now = new Date()) {
  const KST = 9 * 3600 * 1000;
  const k = new Date(now.getTime() + KST);
  const y = k.getUTCFullYear();
  const m = k.getUTCMonth(); // 이번 달(0~11)
  const start = new Date(Date.UTC(y, m - 1, 1) - KST);
  const end = new Date(Date.UTC(y, m, 1) - KST);
  const ky = new Date(start.getTime() + KST);
  return { start, end, label: `${ky.getUTCFullYear()}-${String(ky.getUTCMonth() + 1).padStart(2, "0")}` };
}

type Row = Awaited<ReturnType<typeof monthlyActivity>>[number];

export function digestText(rows: Row[], label: string, site: string) {
  const installs = rows.reduce((n, r) => n + r.installs, 0);
  const uses = rows.reduce((n, r) => n + r.uses, 0);
  const lines = rows.map((r) => `- ${r.name}: 받아 감 ${r.installs} · 써봤어요 ${r.uses}\n  ${site}/skills/${encodeURIComponent(r.slug)}`);
  return {
    subject: installs
      ? `[스킬마켓] ${label} 내 스킬을 동료 ${installs}명이 받아 갔습니다`
      : `[스킬마켓] ${label} 동료 ${uses}명이 내 스킬을 써봤어요`,
    text:
      `${rows[0].author_name} 님, ${label} 한 달 동안 동료들이 회원님의 스킬을 이렇게 썼습니다.\n\n` +
      `받아 간 사람 ${installs} · 써봤어요 ${uses} (본인 제외, 사람당 한 번)\n\n${lines.join("\n")}\n\n` +
      `명예의 전당: ${site}/hall\n이 메일은 매달 1일, 지난달 활동이 있을 때만 갑니다.`,
  };
}

// 지난달 활동이 있는 사내 원작자 중 이번 달 아직 안 보낸 사람
export async function digestTargets(db: Db, now = new Date()) {
  const { start, end, label } = lastMonthKst(now);
  const rows = await monthlyActivity(db, start, end);
  const sent = new Set((await db.query<{ email: string }>("SELECT email FROM app.digest_sent WHERE month = $1", [label])).map((r) => r.email));
  const byAuthor = new Map<string, Row[]>();
  for (const r of rows) {
    if (sent.has(r.author_email) || !normalizeEmail(r.author_email)) continue;
    byAuthor.set(r.author_email, [...(byAuthor.get(r.author_email) ?? []), r]);
  }
  return { label, targets: [...byAuthor].map(([email, list]) => ({ email, rows: list })) };
}

// 한 사람씩: 먼저 '보냄'으로 잡고(Cron 이 겹쳐 불려도 두 번 안 가게) 보내고, 실패하면 풀어 다음 실행 때 다시.
export async function sendDigests(db: Db, send: (t: { email: string; rows: Row[] }, label: string) => Promise<void>, now = new Date()) {
  const { label, targets } = await digestTargets(db, now);
  let sent = 0;
  for (const t of targets.slice(0, MAX_DIGESTS_PER_RUN)) {
    const claimed = await db.query("INSERT INTO app.digest_sent (month, email) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1", [label, t.email]);
    if (!claimed.length) continue;
    try {
      await send(t, label);
      sent++;
    } catch (e) {
      await db.query("DELETE FROM app.digest_sent WHERE month = $1 AND email = $2", [label, t.email]);
      console.error("월간 기여 메일 실패", t.email, e);
    }
  }
  return { month: label, waiting: targets.length, sent };
}

import crypto from "node:crypto";
import { one, type Db } from "./db.ts";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_WINDOW = 3; // CODE_TTL_MS 창 안에서
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// 6자리 코드 무작위 대입 상한: 이메일당 하루 틀린 코드 합계가 이만큼이면 그날은 새 코드도 안 준다
export const MAX_FAILS_PER_DAY = 10;
export const MAX_SENDS_PER_DAY = 10; // 이메일당
export const MAX_SENDS_PER_IP_HOUR = 20; // 여러 주소로 메일 폭탄 방지
export const MAX_SENDS_GLOBAL_DAY = 400; // ponytail: Gmail 하루 한도(약 500) 보호. 넘으면 그날 로그인 메일 중단 → 사용자가 늘면 Resend 로

export function allowedDomains(env = process.env.ALLOWED_EMAIL_DOMAINS) {
  return (env || "samsung.com,cheil.com").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

// 허용 도메인과 @ 뒤가 정확히 같을 때만 정규화된 이메일, 아니면 null
export function normalizeEmail(raw: string, domains = allowedDomains()): string | null {
  const email = raw.trim().toLowerCase();
  const m = email.match(/^[a-z0-9._%+-]+@([a-z0-9.-]+)$/);
  return m && domains.includes(m[1]) ? email : null;
}

function hashCode(email: string, code: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

// 로그인 후 돌아갈 주소: 같은 사이트 경로만. "/	/evil.com" 처럼 브라우저가 외부 주소로 읽는 값은 "/"
export function safeNext(raw: string) {
  try {
    const u = new URL(raw, "http://x");
    return raw.startsWith("/") && u.origin === "http://x" ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

// 새 코드를 발급해 DB 에 해시로 저장하고 평문 코드를 돌려준다(메일 발송용). 발송 한도 초과면 null.
export async function issueCode(db: Db, email: string, secret: string, now = Date.now(), ip = ""): Promise<string | null> {
  return db.tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(424243)"); // ponytail: 발송 전체를 한 줄로 세운다(한도 경쟁 방지). 발송량이 많아지면 이메일별 잠금으로
    const c = (await one<{ win: number; day: number; fails: number; ip: number; total: number }>(
      t,
      `SELECT COUNT(*) FILTER (WHERE email = $1 AND created_at > $2)::int AS win,
              COUNT(*) FILTER (WHERE email = $1)::int AS day,
              COALESCE(SUM(attempts) FILTER (WHERE email = $1), 0)::int AS fails,
              COUNT(*) FILTER (WHERE $4 <> '' AND ip = $4 AND created_at > $5)::int AS ip,
              COUNT(*)::int AS total
       FROM app.login_codes WHERE created_at > $3`,
      [email, now - CODE_TTL_MS, now - DAY_MS, ip, now - HOUR_MS],
    ))!;
    if (c.win >= MAX_SENDS_PER_WINDOW || c.day >= MAX_SENDS_PER_DAY || c.fails >= MAX_FAILS_PER_DAY || c.ip >= MAX_SENDS_PER_IP_HOUR || c.total >= MAX_SENDS_GLOBAL_DAY) return null;
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    await t.query("INSERT INTO app.login_codes (email, code_hash, expires_at, created_at, ip) VALUES ($1, $2, $3, $4, $5)", [
      email,
      hashCode(email, code, secret),
      now + CODE_TTL_MS,
      now,
      ip,
    ]);
    return code;
  });
}

type CodeRow = { id: number; code_hash: string; expires_at: number; attempts: number; consumed_at: number | null };

// 가장 최근 코드만 유효. 맞으면 사용자를 만들거나 찾아 id 반환, 틀리면 시도 횟수 +1 후 null.
export async function verifyCode(db: Db, email: string, code: string, secret: string, now = Date.now()): Promise<number | null> {
  return db.tx(async (t) => {
    const row = await one<CodeRow>(
      t,
      "SELECT id, code_hash, expires_at, attempts, consumed_at FROM app.login_codes WHERE email = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [email],
    );
    if (!row || row.consumed_at !== null || row.expires_at <= now || row.attempts >= MAX_ATTEMPTS) return null;

    const got = Buffer.from(hashCode(email, code.trim(), secret));
    const want = Buffer.from(row.code_hash);
    if (!crypto.timingSafeEqual(got, want)) {
      await t.query("UPDATE app.login_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
      return null;
    }
    await t.query("UPDATE app.login_codes SET consumed_at = $1 WHERE id = $2", [now, row.id]);
    const user = await one<{ id: number }>(
      t,
      `INSERT INTO app.users (email, last_login_at) VALUES ($1, now())
       ON CONFLICT (email) DO UPDATE SET last_login_at = now() RETURNING id`,
      [email],
    );
    return user!.id;
  });
}

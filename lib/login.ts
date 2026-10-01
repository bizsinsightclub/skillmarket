import crypto from "node:crypto";
import { one, type Db } from "./db.ts";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_WINDOW = 3; // CODE_TTL_MS 창 안에서

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

// 새 코드를 발급해 DB 에 해시로 저장하고 평문 코드를 돌려준다(메일 발송용). 발송 한도 초과면 null.
export async function issueCode(db: Db, email: string, secret: string, now = Date.now()): Promise<string | null> {
  const recent = await one<{ n: number }>(db, "SELECT COUNT(*)::int AS n FROM app.login_codes WHERE email = $1 AND created_at > $2", [email, now - CODE_TTL_MS]);
  if (recent!.n >= MAX_SENDS_PER_WINDOW) return null;
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.query("INSERT INTO app.login_codes (email, code_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)", [
    email,
    hashCode(email, code, secret),
    now + CODE_TTL_MS,
    now,
  ]);
  return code;
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

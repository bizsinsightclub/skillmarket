import crypto from "node:crypto";

function hmac(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

// "<payload>.<hmac>" 형태. payload 에 '.' 이 있어도 마지막 '.' 기준으로 자른다.
export function sign(payload: string, secret: string) {
  return `${payload}.${hmac(payload, secret)}`;
}

export function verify(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const got = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(hmac(payload, secret));
  return got.length === want.length && crypto.timingSafeEqual(got, want) ? payload : null;
}

export function safeEqual(a: string, b: string) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// 세션 쿠키: payload = "user:<id>:<만료 epoch ms>"
export function makeSessionToken(userId: number, secret: string, ttlMs: number, now = Date.now()) {
  return sign(`user:${userId}:${now + ttlMs}`, secret);
}

export function readSessionToken(token: string | undefined, secret: string, now = Date.now()): number | null {
  const m = verify(token, secret)?.match(/^user:(\d+):(\d+)$/);
  if (!m || Number(m[2]) <= now) return null;
  return Number(m[1]);
}

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, one } from "./db";
import { readSessionToken } from "./sign";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type User = { id: number; email: string; name: string; department: string };

export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET 환경변수가 필요합니다");
  return "dev-only-secret";
}

export async function getCurrentUser(): Promise<User | null> {
  const id = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value, authSecret());
  if (id === null) return null;
  return (await one<User>(getDb(), "SELECT id, email, name, department FROM app.users WHERE id = $1", [id])) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isEditor(user: User | null) {
  if (!user) return false;
  const editors = (process.env.EDITOR_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  return editors.includes(user.email);
}

// http 사내 서버에서도 쿠키가 살도록 https 일 때만 Secure
export async function cookieSecure() {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
}

export async function requireViewer() {
  const user = await requireUser();
  return { user, viewer: { id: user.id, email: user.email, editor: isEditor(user) } };
}

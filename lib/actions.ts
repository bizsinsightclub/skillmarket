"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, one } from "./db";
import { SESSION_COOKIE, SESSION_TTL_MS, authSecret, cookieSecure, requireUser } from "./auth";
import { makeSessionToken } from "./sign";
import { issueCode, normalizeEmail, verifyCode } from "./login";
import { sendLoginCode } from "./mail";

function field(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

// 오픈 리다이렉트 방지: 사이트 내부 경로만
function safeNext(raw: string) {
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
}

export type LoginState = { step: "email" | "code"; email?: string; error?: string };

// 한 폼이 두 단계를 처리: 이메일만 오면 코드 발송, 코드까지 오면 검증 후 로그인
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = normalizeEmail(field(form, "email", 200));
  if (!email) return { step: "email", error: "samsung.com 또는 cheil.com 메일만 가입할 수 있습니다" };

  const code = field(form, "code", 6);
  if (!code) {
    const issued = await issueCode(getDb(), email, authSecret());
    if (!issued) return { step: "code", email, error: "코드를 너무 자주 요청했습니다. 10분 뒤에 다시 시도하세요" };
    try {
      await sendLoginCode(email, issued);
    } catch (e) {
      console.error("[mail] 발송 실패", e);
      return { step: "email", email, error: "메일 발송에 실패했습니다. 잠시 뒤 다시 시도하세요" };
    }
    return { step: "code", email };
  }

  const userId = await verifyCode(getDb(), email, code, authSecret());
  if (userId === null) return { step: "code", email, error: "코드가 맞지 않거나 만료되었습니다" };

  (await cookies()).set(SESSION_COOKIE, makeSessionToken(userId, authSecret(), SESSION_TTL_MS), {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  const u = await one<{ name: string }>(getDb(), "SELECT name FROM app.users WHERE id = $1", [userId]);
  redirect(u?.name ? safeNext(field(form, "next", 500)) : "/me"); // 첫 가입이면 이름부터
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function updateProfile(form: FormData) {
  const user = await requireUser();
  const name = field(form, "name", 50);
  if (!name) return;
  await getDb().query("UPDATE app.users SET name = $1, department = $2 WHERE id = $3", [name, field(form, "department", 100), user.id]);
  revalidatePath("/", "layout");
  redirect("/");
}

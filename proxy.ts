import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionToken } from "./lib/sign";

// 사이트 전체 로그인 필수(예외: /api/cron/* 는 CRON_SECRET 으로 직접 검사). 서명·만료만 확인하고, 사용자 조회는 getCurrentUser() 가 한다.
export function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret");
  if (secret && readSessionToken(request.cookies.get("session")?.value, secret) !== null) return NextResponse.next();

  const url = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/cron/|_next/static|_next/image|favicon.ico).*)"],
};

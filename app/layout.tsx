import type { Metadata } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"; // 무료(OFL) 한글 웹폰트, 자체 호스팅
import "./globals.css";
import { getCurrentUser, isEditor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { countPending, unreadNotices } from "@/lib/queries";
import CheilLogo from "@/components/cheil-logo";
import NavMenu from "@/components/nav-menu";

export const metadata: Metadata = {
  title: "스킬마켓",
  description: "사내 Claude 스킬 마켓플레이스",
};

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-[18px] text-white tabular-nums">{n > 99 ? "99+" : n}</span>;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const editor = isEditor(user);
  // 에디터는 검수 대기함(대기 건수), 일반 사용자는 알림함(안 읽은 수)
  const badge = user ? await (editor ? countPending(getDb()) : unreadNotices(getDb(), user.id)) : 0;
  const link = "whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium text-black/65 hover:bg-white/70 hover:text-ink";

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* 떠 있는 유리 내비: [로고 · 메뉴 상자] ··· [검색 · 내 이름 · 내정보 · 검수대기함/알림함 · 올리기]
            로그인 전(= 로그인 화면)엔 그리지 않는다 — 로그인 화면이 로고를 직접 쓴다 */}
        {user && (
          <header className="sticky top-3 z-30 px-3 sm:px-6">
            <nav className="glass mx-auto flex max-w-[1400px] items-center gap-4 rounded-2xl py-2 pl-4 pr-2 text-sm">
              <Link href="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-extrabold tracking-tight">
                <CheilLogo className="h-[18px] w-auto" />
                <span aria-hidden className="h-4 w-px bg-black/20" />
                스킬마켓
              </Link>
              <NavMenu />
              {/* 유리 위에서도 입력칸임이 분명하게: 불투명 흰 바탕 + 또렷한 테두리 + 돋보기 */}
              <form action="/skills" role="search" className="relative ml-auto hidden w-60 xl:block">
                <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
                <input name="q" aria-label="스킬 검색" placeholder="어떤 스킬을 찾으세요?" className="w-full rounded-xl border border-black/15 bg-white py-2 pl-9 pr-3 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] outline-none placeholder:text-black/50 focus:border-black/40 focus:ring-2 focus:ring-accent" />
              </form>
              <div className="ml-auto flex items-center gap-1 xl:ml-0">
                <span className="hidden max-w-32 truncate px-2 font-bold sm:inline">{user.name || user.email}</span>
                <Link href="/me" className={link}>내정보</Link>
                {editor ? (
                  <Link href="/editor" className={`${link} flex items-center`}>검수대기함<Badge n={badge} /></Link>
                ) : (
                  <Link href="/inbox" className={`${link} flex items-center`}>알림함<Badge n={badge} /></Link>
                )}
                <Link href="/write" className="ml-1 whitespace-nowrap rounded-xl bg-ink px-4 py-2 font-bold text-white hover:bg-black">올리기</Link>
              </div>
            </nav>
          </header>
        )}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-10 sm:px-8">{children}</main>
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-10 text-xs text-black/40 sm:px-8">
          스킬마켓 · 사내 Claude 스킬 공유 · 서체 Pretendard (SIL OFL)
        </footer>
      </body>
    </html>
  );
}

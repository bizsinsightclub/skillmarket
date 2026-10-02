import type { Metadata } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"; // 무료(OFL) 한글 웹폰트, 자체 호스팅
import "./globals.css";
import { getCurrentUser, isEditor } from "@/lib/auth";
import CheilLogo from "@/components/cheil-logo";

export const metadata: Metadata = {
  title: "스킬마켓",
  description: "사내 Claude 스킬 마켓플레이스",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* 떠 있는 유리 내비 (Raycast Store) */}
        <header className="sticky top-3 z-30 px-3 sm:px-6">
          <nav className="site-nav glass mx-auto flex max-w-[1400px] items-center gap-6 rounded-2xl px-4 py-2.5 text-sm transition-colors">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-extrabold tracking-tight">
              <CheilLogo className="h-[18px] w-auto" />
              <span aria-hidden className="h-4 w-px bg-black/20" />
              스킬마켓
            </Link>
            {user && (
              <>
                <div className="hidden items-center gap-1 font-medium text-black/60 md:flex">
                  {[["/skills", "스킬"], ["/plugins", "플러그인·MCP"], ["/experts", "전문가"], ["/picks", "에디터 픽"]].map(([href, label]) => (
                    <Link key={href} href={href} className={`nav-link flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${href === "/experts" ? "text-lens-deep hover:bg-lens-bg" : "hover:bg-white/70 hover:text-ink"}`}>
                      {href === "/experts" && <span className="nav-dot h-1.5 w-1.5 rounded-full bg-lens" />}
                      {label}
                    </Link>
                  ))}
                </div>
                {/* 유리 위에서도 입력칸임이 분명하게: 불투명 흰 바탕 + 또렷한 테두리 + 돋보기 */}
                <form action="/skills" role="search" className="relative ml-auto hidden w-72 sm:block">
                  <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
                  <input name="q" aria-label="스킬 검색" placeholder="어떤 스킬을 찾으세요?" className="w-full rounded-xl border border-black/15 bg-white py-2 pl-9 pr-3 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] outline-none placeholder:text-black/50 focus:border-black/40 focus:ring-2 focus:ring-accent" />
                </form>
                <div className="ml-auto flex items-center gap-3 sm:ml-0">
                  {isEditor(user) && <Link href="/editor" className="hidden whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-bold sm:inline">검수 대기함</Link>}
                  <Link href="/me" className="max-w-32 truncate whitespace-nowrap font-medium text-black/70 hover:text-ink">{user.name || user.email}</Link>
                  <Link href="/write" className="nav-upload whitespace-nowrap rounded-xl bg-ink px-4 py-2 font-bold text-white hover:bg-black">올리기</Link>
                </div>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-10 sm:px-8">{children}</main>
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-10 text-xs text-black/40 sm:px-8">
          스킬마켓 · 사내 Claude 스킬 공유 · 서체 Pretendard (SIL OFL)
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser, isEditor } from "@/lib/auth";

export const metadata: Metadata = {
  title: "스킬마켓",
  description: "사내 Claude 스킬 마켓플레이스",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-black/5 bg-paper/85 backdrop-blur">
          <nav className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3 text-sm sm:px-8">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-base text-accent">S</span>
              스킬마켓
            </Link>
            {user && (
              <>
                <div className="hidden items-center gap-5 text-black/60 md:flex">
                  <Link href="/skills" className="hover:text-ink">전체 스킬</Link>
                  <Link href="/skills?tab=curated" className="hover:text-ink">큐레이티드</Link>
                  <Link href="/skills?tab=pick" className="hover:text-ink">에디터 픽</Link>
                </div>
                <form action="/skills" className="ml-auto hidden w-72 sm:block">
                  <input name="q" placeholder="어떤 스킬을 찾으세요?" className="w-full rounded-full border border-black/10 px-4 py-2 outline-none focus:border-black/40" />
                </form>
                <div className="ml-auto flex items-center gap-3 sm:ml-0">
                  {isEditor(user) && <Link href="/editor" className="hidden whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-semibold sm:inline">검수 대기함</Link>}
                  <Link href="/me" className="max-w-32 truncate whitespace-nowrap text-black/70 hover:text-ink">{user.name || user.email}</Link>
                  <Link href="/write" className="whitespace-nowrap rounded-full bg-ink px-4 py-2 font-semibold text-white">올리기</Link>
                </div>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-8">{children}</main>
      </body>
    </html>
  );
}

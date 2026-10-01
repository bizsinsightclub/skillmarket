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
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-bold">스킬마켓</Link>
            {user && (
              <div className="ml-auto flex items-center gap-4">
                {isEditor(user) && <Link href="/editor" className="rounded bg-black px-2 py-0.5 text-xs text-white">검수 대기함</Link>}
                <Link href="/write">글쓰기</Link>
                <Link href="/me">{user.name || user.email}</Link>
              </div>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

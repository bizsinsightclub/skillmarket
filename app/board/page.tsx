import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { BOARD_PAGE, listPosts } from "@/lib/community";
import PostList from "@/components/post-list";

// AI Breakthrough 게시판 목록. 메뉴 색은 앰버(헤더 메뉴 상자의 menu-board)
export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  await requireViewer();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listPosts(getDb(), { q, page });
  const pages = Math.ceil(total / BOARD_PAGE);
  const href = (p: number) => `/board?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="mx-auto max-w-4xl">
      <span hidden data-tab="/board" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-4xl font-extrabold tracking-[-0.03em]">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            {q ? `“${q}” 검색 결과` : "AI Breakthrough"}
          </h1>
          <p className="mt-1 text-sm text-black/50">새 모델·연구·사례를 나누고 의견을 남기는 게시판 · {total}개</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/board" role="search">
            <input name="q" defaultValue={q} aria-label="게시판 검색" placeholder="제목·본문 검색" className="w-44 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40" />
          </form>
          <Link href="/board/new" className="whitespace-nowrap rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600">글쓰기</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="glass rounded-2xl py-16 text-center text-black/50">{q ? "검색 결과가 없습니다." : "아직 글이 없습니다. 눈여겨본 AI 소식을 첫 글로 올려 보세요."}</p>
      ) : (
        <PostList rows={rows} />
      )}

      {pages > 1 && (
        <nav className="mt-10 flex justify-center gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href(n)} className={`grid h-9 w-9 place-items-center rounded-full font-semibold ${n === page ? "bg-amber-500 text-white" : "glass"}`}>{n}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}

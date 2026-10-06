import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { PostRow } from "@/lib/community";

// 게시판 글 목록 줄. 목록 화면과 글 화면 아래(지금 보는 글 = current 표시)에서 같이 쓴다.
export default function PostList({ rows, current }: { rows: PostRow[]; current?: number }) {
  return (
    <ul className="panel divide-y divide-black/5 overflow-hidden rounded-2xl">
      {rows.map((p) => {
        const here = p.id === current;
        return (
          <li key={p.id}>
            <Link href={`/board/${p.id}`} aria-current={here ? "page" : undefined} className={`block px-5 py-4 ${here ? "bg-amber-50" : "hover:bg-amber-50/60"}`}>
              <p className="flex items-center gap-2 font-semibold">
                {here && <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">보는 중</span>}
                <span className="min-w-0 truncate">{p.title}</span>
                {p.link_url && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{new URL(p.link_url).hostname.replace(/^www\./, "")}</span>}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-black/45">
                <span>{p.author}</span>
                <span>{fmtDate(p.created_at)}</span>
                {p.comments > 0 && <span>댓글 {p.comments}</span>}
                {p.reactions > 0 && <span>♥ {p.reactions}</span>}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

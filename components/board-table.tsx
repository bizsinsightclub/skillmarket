import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { BoardRow } from "@/lib/queries";

export default function BoardTable({ rows, firstNumber }: { rows: BoardRow[]; firstNumber: number }) {
  return (
    <table className="w-full table-fixed border-t-2 border-black text-sm">
      <thead className="border-b border-black/20 bg-black/[.03] text-black/60">
        <tr>
          <th className="w-16 py-2 font-normal">번호</th>
          <th className="w-20 font-normal">분류</th>
          <th className="font-normal">제목</th>
          <th className="w-28 font-normal">원작자</th>
          <th className="w-16 font-normal">좋아요</th>
          <th className="w-16 font-normal">설치</th>
          <th className="w-24 font-normal">등록일</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={7} className="py-16 text-center text-black/40">등록된 스킬이 없습니다</td></tr>
        )}
        {rows.map((r, i) => (
          <tr key={r.id} className="border-b border-black/10 hover:bg-black/[.02]">
            <td className="py-2.5 text-center text-black/40">{firstNumber - i}</td>
            <td className="text-center text-black/60">{r.category_label}</td>
            <td>
              <Link href={`/skills/${r.slug}`} className="flex min-w-0 items-center gap-2 hover:underline">
                {r.thumb && <img src={`/files/${r.thumb}`} alt="" className="h-8 w-12 shrink-0 rounded object-cover" />}
                <span className="shrink-0 font-medium">{r.name}</span>
                {r.editor_pick ? <span className="shrink-0 whitespace-nowrap rounded bg-black px-1.5 text-xs text-white">에디터 픽</span> : null}
                {r.curated && !r.editor_pick ? <span className="shrink-0 whitespace-nowrap rounded border border-black px-1.5 text-xs">검수 완료</span> : null}
                {r.visibility === "restricted" && <span className="shrink-0 whitespace-nowrap rounded bg-black/10 px-1.5 text-xs">비공개</span>}
                <span className="min-w-0 truncate text-black/40">{r.summary}</span>
              </Link>
            </td>
            <td className="text-center"><Link href={`/u/${encodeURIComponent(r.author_email)}`} className="hover:underline">{r.author_name}</Link></td>
            <td className="text-center">{r.likes}</td>
            <td className="text-center">{r.installs}</td>
            <td className="text-center text-black/50">{fmtDate(r.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

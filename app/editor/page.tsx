import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { listPending } from "@/lib/queries";

export default async function EditorPage() {
  const { viewer } = await requireViewer();
  if (!viewer.editor) notFound();
  const pending = await listPending(getDb());
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">검수 대기함</h1>
      <table className="w-full border-t-2 border-black text-sm">
        <thead className="border-b border-black/20 bg-black/[.03] text-black/60">
          <tr>
            <th className="py-2 text-left font-normal">스킬</th>
            <th className="font-normal">원작자</th>
            <th className="font-normal">구분</th>
            <th className="font-normal">요청일</th>
          </tr>
        </thead>
        <tbody>
          {pending.length === 0 && (
            <tr><td colSpan={4} className="py-16 text-center text-black/40">대기 중인 검수 요청이 없습니다</td></tr>
          )}
          {pending.map((p) => (
            <tr key={p.id} className="border-b border-black/10">
              <td className="py-2.5">
                <Link href={`/skills/${p.slug}`} className="font-medium hover:underline">{p.name}</Link>
                {p.visibility === "restricted" && <span className="ml-2 rounded bg-black/10 px-1.5 text-xs">비공개</span>}
              </td>
              <td className="text-center">{p.author_name}</td>
              <td className="text-center">{p.curated_version_id ? "재검수" : "신규"}</td>
              <td className="text-center text-black/50">{fmtDate(p.updated_at, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-black/60">스킬을 열어 큐레이션 영역에서 승인·반려합니다.</p>
    </div>
  );
}

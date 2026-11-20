import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { listPending, listReports } from "@/lib/queries";
import ResolveForm from "@/components/resolve-form";
import { BulkBar, QueueActions, SelectAll } from "@/components/queue-actions";

export default async function EditorPage() {
  const { viewer } = await requireViewer();
  if (!viewer.editor) notFound();
  const db = getDb();
  const [pending, reports] = await Promise.all([listPending(db), listReports(db)]);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-[-0.03em]">검수 대기함 {pending.length > 0 && <span className="text-black/40">{pending.length}</span>}</h1>
        {pending.length > 0 && <BulkBar />}
      </div>
      {/* overflow-hidden 을 쓰면 이름 위 설명 풍선이 잘린다 */}
      <table className="panel w-full rounded-2xl text-sm">
        <thead className="border-b border-black/20 text-black/60">
          <tr>
            <th className="w-8 py-2 pl-4 font-normal">{pending.length > 0 && <SelectAll />}</th>
            <th className="py-2 pl-2 pr-2 text-left font-normal">스킬</th>
            <th className="hidden whitespace-nowrap px-2 font-normal md:table-cell">크레딧</th>
            <th className="whitespace-nowrap px-2 font-normal">구분</th>
            <th className="hidden whitespace-nowrap px-2 font-normal sm:table-cell">요청일</th>
            <th className="pl-2 pr-4 text-right font-normal">처리</th>
          </tr>
        </thead>
        <tbody>
          {pending.length === 0 && (
            <tr><td colSpan={6} className="py-16 text-center text-black/40">대기 중인 검수 요청이 없습니다</td></tr>
          )}
          {pending.map((p) => (
            <tr key={p.id} className="border-b border-black/10 last:border-0">
              <td className="py-2.5 pl-4">
                <input type="checkbox" form="bulk" name="pick" value={`${p.id}:${p.version_id}`} aria-label={`${p.name} 고르기`} />
              </td>
              <td className="py-2.5 pl-2 pr-2">
                {/* 이름에 마우스를 올리거나(키보드는 포커스) 하면 요약 풍선 */}
                <span className="group relative">
                  <Link href={`/skills/${p.slug}`} className="font-medium hover:underline">{p.name}</Link>
                  <span role="tooltip" className="glass pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-80 max-w-[80vw] rounded-xl p-3 text-xs font-normal leading-relaxed group-focus-within:block group-hover:block">
                    <span className="block text-black/50">
                      {p.category_label}{p.version !== "link" && ` · v${p.version}`} · 올린 사람 {p.uploader}{p.maker && ` · 만든 곳 ${p.maker}`}
                    </span>
                    <span className="mt-1 block text-black/85">{p.summary || "요약 없음"}</span>
                  </span>
                </span>
                {p.visibility === "restricted" && <span className="ml-2 rounded bg-black/10 px-1.5 text-xs">비공개</span>}
              </td>
              <td className="hidden whitespace-nowrap px-2 text-center md:table-cell">{p.author_name}</td>
              <td className="whitespace-nowrap px-2 text-center">{p.curated_version_id ? "재검수" : "신규"}</td>
              <td className="hidden whitespace-nowrap px-2 text-center text-black/50 sm:table-cell">{fmtDate(p.updated_at, true)}</td>
              <td className="py-2 pl-2 pr-4"><QueueActions row={`${p.id}:${p.version_id}`} name={p.name} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-black/60">
        여기서 바로 승인·반려·삭제하거나, 글을 열어 내용을 본 뒤 검수 영역에서 처리합니다. 승인은 목록에 보이는 그 버전으로 고정됩니다.
        전사 공개 글(링크형 제외)은 승인돼야 다른 사람에게 보입니다. 삭제한 브리핑 글은 다음 브리핑에 다시 올라오지 않습니다.
        보안(스크립트가 하는 일)과 민감정보(광고주·고객 정보, 개인정보)를 확인하세요.
      </p>

      <h2 className="mb-4 mt-12 text-2xl font-extrabold tracking-[-0.02em]">출처 신고 {reports.length > 0 && <span className="text-black/40">{reports.length}</span>}</h2>
      {reports.length === 0 ? (
        <p className="panel rounded-2xl py-10 text-center text-sm text-black/40">열린 신고가 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="panel rounded-2xl p-5 text-sm">
              <p>
                <Link href={`/skills/${r.slug}`} className="font-semibold underline">{r.name}</Link>
                <span className="text-black/50"> · {r.reporter} · {fmtDate(r.created_at, true)}</span>
              </p>
              <p className="my-3 whitespace-pre-wrap text-black/75">{r.reason}</p>
              <ResolveForm reportId={r.id} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-black/60">원작자를 고치려면 글의 수정 화면에서 바꾸세요. 바꾼 기록은 원작자 변경 이력에 남습니다.</p>
    </div>
  );
}

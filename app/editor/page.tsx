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
        {pending.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-black/55"><SelectAll /> 모두 고르기</label>
            <BulkBar />
          </div>
        )}
      </div>

      {/* 인덱스 카드: 호버 없이 핵심 한 줄·분류·신규/재검수·안전검사가 바로 보이게. 긴 내용은 '자세히'. */}
      <ul className="flex flex-col gap-2.5">
        {pending.length === 0 && <li className="panel rounded-2xl py-16 text-center text-sm text-black/40">대기 중인 검수 요청이 없습니다</li>}
        {pending.map((p) => (
          <li key={p.id} className="panel rounded-2xl p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <input type="checkbox" form="bulk" name="pick" value={`${p.id}:${p.version_id}`} aria-label={`${p.name} 고르기`} className="mt-1" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <span className={`rounded-full px-2 py-0.5 ${p.curated_version_id ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{p.curated_version_id ? "재검수" : "신규"}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-black/60">{p.category_label}</span>
                  {(p.post_type === "skill" || p.scan_rec) && <ScanBadge rec={p.scan_rec} score={p.scan_score} />}
                  {p.visibility === "restricted" && <span className="rounded-full bg-black/10 px-2 py-0.5 text-black/60">비공개</span>}
                  <span className="ml-auto font-normal text-black/40">{fmtDate(p.updated_at, true)}</span>
                </div>
                <Link href={`/skills/${p.slug}`} className="mt-1.5 block truncate text-base font-bold hover:underline">{p.name}</Link>
                <p className="mt-0.5 truncate text-[15px] font-semibold text-ink/80">{p.gist || p.summary || "요약 없음"}</p>
                <div className="mt-1 truncate text-xs text-black/45">
                  {p.version !== "link" && `v${p.version} · `}올린 사람 {p.uploader}{p.maker ? ` · 만든 곳 ${p.maker}` : ` · 원작자 ${p.author_name}`}
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer select-none text-xs font-semibold text-black/45 hover:text-ink">자세히</summary>
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-black/[0.03] p-3 leading-relaxed">
                    {p.summary && <p className="text-black/80">{p.summary}</p>}
                    {p.ai_desc && <p className="text-black/60"><span className="mr-1 text-[10px] font-bold text-sky-700/70">README 요약</span>{p.ai_desc}</p>}
                    {p.homepage_url && /^https?:\/\//i.test(p.homepage_url) && (
                      <a href={p.homepage_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-sky-700 hover:underline">{p.homepage_url} ↗</a>
                    )}
                    {p.scan_findings && p.scan_findings.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-black/45">안전검사 발견 (상위 {p.scan_findings.length}개)</div>
                        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-black/65">
                          {p.scan_findings.map((f, i) => (
                            <li key={i} className="truncate"><span className="font-semibold">{f.severity}</span> · {f.category} · {f.id}{f.id === "AE1" && <span className="text-amber-700"> (참조 파일을 다 못 봄 — 악성 근거 아님)</span>}{f.file && <span className="text-black/40"> — {f.file}{f.line ? `:${f.line}` : ""}</span>}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              </div>
              {/* 휴대폰: 내용 아래 / 넓은 화면: 오른쪽 — 한 번만 그린다 */}
              <div className="col-start-2 sm:col-start-3 sm:row-start-1">
                <QueueActions row={`${p.id}:${p.version_id}`} name={p.name} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-black/60">
        여기서 바로 승인·반려·삭제하거나, 글을 열어 내용을 본 뒤 검수 영역에서 처리합니다. 승인은 목록에 보이는 그 버전으로 고정됩니다.
        전사 공개 글(링크형 제외)은 승인돼야 다른 사람에게 보입니다. 삭제한 브리핑 글은 다음 브리핑에 다시 올라오지 않습니다.
        보안(스크립트가 하는 일)과 민감정보(광고주·고객 정보, 개인정보)를 확인하세요.
        안전검사 배지는 NVIDIA skillspector(정적 검사) 결과 — 에디터 PC 에서 <code className="text-xs">npm run scan</code> 으로 갱신합니다. 한국어 지시문은 놓칠 수 있어 참고용입니다.
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

// 안전검사 배지: skillspector 권고 → 색. 미검사도 보이게(검사 안 된 걸 안전으로 착각하지 않게).
function ScanBadge({ rec, score }: { rec: string | null; score: number | null }) {
  const m: Record<string, [string, string]> = {
    SAFE: ["안전", "bg-emerald-100 text-emerald-800"],
    CAUTION: ["주의", "bg-amber-100 text-amber-800"],
    DO_NOT_INSTALL: ["위험", "bg-red-100 text-red-700"],
    ERROR: ["검사 실패", "bg-black/10 text-black/55"],
  };
  const [label, cls] = rec ? m[rec] ?? [rec, "bg-black/10 text-black/55"] : ["미검사", "text-black/40 ring-1 ring-black/10"];
  return <span className={`rounded-full px-2 py-0.5 ${cls}`} title="NVIDIA skillspector 정적 검사">검사 {label}{rec && rec !== "ERROR" && score !== null ? ` ${score}` : ""}</span>;
}

import Link from "next/link";

// 매트릭스 치트맵: 행=플러그인, 열=7개 분야, 셀 진하기=그 분야 관련도(중심벡터 코사인).
// 한 행을 가로로 읽으면 '이 플러그인이 어느 영역들에 가까운가'가 보인다. 지정 분야 셀은 테두리로 표시.
type Row = { slug: string; name: string; topic: string; rels: number[] };
const COLOR: Record<string, string> = { doc: "#64748b", slides: "#f59e0b", data: "#0ea5e9", design: "#ec4899", dev: "#6366f1", automation: "#10b981", etc: "#94a3b8" };
const a2 = (rel: number) => Math.round(Math.max(0, Math.min(1, rel)) * 255).toString(16).padStart(2, "0"); // 0~1 → 2자리 hex 알파

export default function PluginMatrix({ topics, rows }: { topics: { slug: string; label: string }[]; rows: Row[] }) {
  return (
    <div>
      <div className="max-h-[72vh] overflow-auto rounded-2xl ring-1 ring-black/10">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 bg-white px-3 py-2 text-left font-semibold text-black/50">플러그인 \ 분야</th>
              {topics.map((t) => (
                <th key={t.slug} className="min-w-16 border-b border-black/10 px-1 py-2 text-center text-xs font-bold" style={{ color: COLOR[t.slug] }}>{t.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="group">
                <td className="sticky left-0 z-10 max-w-[14rem] truncate border-b border-black/5 bg-white px-3 py-1.5 group-hover:bg-black/[0.03]">
                  <Link href={`/skills/${r.slug}`} className="truncate font-medium text-ink hover:underline" title={r.name}>{r.name}</Link>
                </td>
                {r.rels.map((rel, i) => {
                  const own = topics[i].slug === r.topic;
                  return (
                    <td key={i} className="border-b border-black/5 p-0.5 text-center" title={`${topics[i].label} ${Math.round(rel * 100)}%`}>
                      <span className={`flex h-7 items-center justify-center rounded-md text-[10px] tabular-nums ${own ? "ring-2 ring-ink/40" : ""} ${rel > 0.55 ? "text-white" : "text-black/55"}`} style={{ backgroundColor: COLOR[topics[i].slug] + a2(rel) }}>
                        {rel >= 0.2 ? Math.round(rel * 100) : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-center text-xs text-black/40">숫자·진하기 = 그 분야와의 관련도(%) · 테두리 = 지정 분야 · 이름 클릭 = 열기</p>
    </div>
  );
}

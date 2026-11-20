"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// 포지셔닝 맵(RadViz): 7개 분야를 원주에 앵커로 두고, 각 플러그인을 분야 관련도로 끌어당겨 배치.
// → 점의 위치가 '이 녀석이 어느 영역(들)에 있는가'. 두 분야 사이면 둘에 걸친 것. 색=지정 분야.
type Row = { slug: string; name: string; topic: string; rels: number[] };
const COLOR: Record<string, string> = { doc: "#64748b", slides: "#f59e0b", data: "#0ea5e9", design: "#ec4899", dev: "#6366f1", automation: "#10b981", etc: "#94a3b8" };
const R = 230;

export default function PluginPositions({ topics, rows }: { topics: { slug: string; label: string }[]; rows: Row[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<(Row & { x: number; y: number }) | null>(null);

  const { anchors, points } = useMemo(() => {
    const n = topics.length;
    const anchors = topics.map((t, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return { ...t, x: Math.cos(a) * R, y: Math.sin(a) * R }; });
    // 분야별 min-max 정규화(열 단위) → 가장 그 분야다운 점이 앵커에 바짝
    const mins = topics.map((_, j) => Math.min(...rows.map((r) => r.rels[j])));
    const maxs = topics.map((_, j) => Math.max(...rows.map((r) => r.rels[j])));
    const points = rows.map((r, idx) => {
      let wx = 0, wy = 0, sw = 0;
      for (let j = 0; j < topics.length; j++) {
        const span = maxs[j] - mins[j] || 1;
        const w = Math.pow(Math.max(0, (r.rels[j] - mins[j]) / span), 2.2); // 정규화 후 제곱으로 선명하게
        wx += w * anchors[j].x; wy += w * anchors[j].y; sw += w;
      }
      let x = sw ? wx / sw : 0, y = sw ? wy / sw : 0;
      const jit = (idx * 2654435761) % 1000 / 1000; // 겹침 분산용 결정적 지터
      x += Math.cos(jit * 6.283) * 6; y += Math.sin(jit * 6.283) * 6;
      const rel = Math.max(...r.rels);
      return { ...r, x, y, rad: 4 + rel * 4 };
    });
    return { anchors, points };
  }, [topics, rows]);

  return (
    <div className="relative">
      <div className="h-[72vh] w-full overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_center,#fff,#f4f5f8)] ring-1 ring-black/5">
        <svg viewBox="-320 -300 640 600" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <circle cx="0" cy="0" r={R} fill="none" stroke="rgba(0,0,0,0.06)" />
          {anchors.map((a) => (
            <g key={a.slug}>
              <line x1="0" y1="0" x2={a.x} y2={a.y} stroke="rgba(0,0,0,0.04)" />
              <circle cx={a.x} cy={a.y} r="6" fill={COLOR[a.slug]} />
              <text x={a.x * 1.12} y={a.y * 1.12} textAnchor="middle" dominantBaseline="middle" className="fill-black/70 text-[15px] font-bold">{a.label}</text>
            </g>
          ))}
          {points.map((p) => (
            <circle
              key={p.slug} cx={p.x} cy={p.y} r={hover?.slug === p.slug ? p.rad + 3 : p.rad}
              fill={COLOR[p.topic] ?? COLOR.etc} fillOpacity={hover?.slug === p.slug ? 1 : 0.78}
              stroke={hover?.slug === p.slug ? "#fff" : "none"} strokeWidth="2"
              className="cursor-pointer"
              onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover((h) => (h?.slug === p.slug ? null : h))}
              onClick={() => router.push(`/skills/${p.slug}`)}
            />
          ))}
        </svg>
      </div>
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-3 w-[min(90%,24rem)] -translate-x-1/2 rounded-2xl bg-ink/92 px-4 py-2.5 text-white shadow-lg">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold">{hover.name}</span>
            <span className="shrink-0 text-[11px] text-white/70">
              {topics.map((t, j) => ({ t, v: hover.rels[j] })).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => `${x.t.label} ${Math.round(x.v * 100)}%`).join(" · ")}
            </span>
          </div>
        </div>
      )}
      <p className="mt-2 text-center text-xs text-black/40">분야 앵커에 가까울수록 그 영역 · 두 분야 사이면 둘에 걸친 것 · 점 클릭 = 열기</p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// 포지셔닝 맵(RadViz): 7개 분야를 원주에 앵커로 두고, 각 플러그인을 분야 관련도로 끌어당겨 배치.
// → 점의 위치가 '이 녀석이 어느 영역(들)에 있는가'. 두 분야 사이면 둘에 걸친 것. 색=지정 분야.
// 겹침 완화 + 줌/팬: 줌인하면 같은 분야 안에서도 거리가 보인다.
type Row = { slug: string; name: string; topic: string; rels: number[] };
const COLOR: Record<string, string> = { doc: "#64748b", slides: "#f59e0b", data: "#0ea5e9", design: "#ec4899", dev: "#6366f1", automation: "#10b981", etc: "#94a3b8" };
const R = 260;

export default function PluginPositions({ topics, rows }: { topics: { slug: string; label: string }[]; rows: Row[] }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Row | null>(null);
  const [cam, setCam] = useState({ s: 1, tx: 0, ty: 0 });

  const { anchors, points } = useMemo(() => {
    const n = topics.length;
    const anchors = topics.map((t, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return { ...t, x: Math.cos(a) * R, y: Math.sin(a) * R }; });
    const mins = topics.map((_, j) => Math.min(...rows.map((r) => r.rels[j])));
    const maxs = topics.map((_, j) => Math.max(...rows.map((r) => r.rels[j])));
    const points = rows.map((r, idx) => {
      let wx = 0, wy = 0, sw = 0;
      for (let j = 0; j < topics.length; j++) {
        const span = maxs[j] - mins[j] || 1;
        const w = Math.pow(Math.max(0, (r.rels[j] - mins[j]) / span), 1.6); // 정규화 후 완만하게(2차 관련도도 위치에 반영)
        wx += w * anchors[j].x; wy += w * anchors[j].y; sw += w;
      }
      const jit = (idx * 2654435761) % 1000 / 1000;
      return { ...r, x: (sw ? wx / sw : 0) + Math.cos(jit * 6.283) * 4, y: (sw ? wy / sw : 0) + Math.sin(jit * 6.283) * 4, rad: 4 + Math.max(...r.rels) * 4 };
    });
    // 겹침 분리(위치 뜻은 유지, 뭉친 점만 살짝 벌림)
    const minD = 13;
    for (let it = 0; it < 45; it++) for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01;
      if (d < minD) { const p = (minD - d) / 2 * 0.5; dx /= d; dy /= d; a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; }
    }
    return { anchors, points };
  }, [topics, rows]);

  // 커서 기준 휠 줌(네이티브 리스너라 preventDefault 가능)
  useEffect(() => {
    const svg = svgRef.current!;
    const toSvg = (cx: number, cy: number) => { const m = svg.getScreenCTM()!.inverse(); const p = new DOMPoint(cx, cy).matrixTransform(m); return p; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      setCam((c) => {
        const ns = Math.min(8, Math.max(0.6, c.s * (e.deltaY < 0 ? 1.15 : 0.87)));
        // 커서 아래 월드점이 고정되도록 tx,ty 보정: world = (p - t)/s  →  t' = p - world*ns
        const wx = (p.x - c.tx) / c.s, wy = (p.y - c.ty) / c.s;
        return { s: ns, tx: p.x - wx * ns, ty: p.y - wy * ns };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // 배경 드래그 = 팬
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const t = e.target as Element;
    if (t.classList.contains("node")) return; // 점에서 시작하면 클릭/호버
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const k = (svgRef.current!.getScreenCTM()!.a) || 1; // 화면px → svg단위 배율
    setCam((c) => ({ ...c, tx: c.tx + (e.clientX - drag.current!.x) / k, ty: c.ty + (e.clientY - drag.current!.y) / k }));
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { drag.current = null; };

  return (
    <div className="relative">
      <div className="h-[72vh] w-full overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_center,#fff,#f4f5f8)] ring-1 ring-black/5">
        <svg ref={svgRef} viewBox="-320 -300 640 600" className="h-full w-full touch-none" style={{ cursor: drag.current ? "grabbing" : "grab" }} preserveAspectRatio="xMidYMid meet" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <g transform={`translate(${cam.tx} ${cam.ty}) scale(${cam.s})`}>
            <circle cx="0" cy="0" r={R} fill="none" stroke="rgba(0,0,0,0.06)" />
            {anchors.map((a) => (
              <g key={a.slug}>
                <line x1="0" y1="0" x2={a.x} y2={a.y} stroke="rgba(0,0,0,0.04)" />
                <circle cx={a.x} cy={a.y} r="6" fill={COLOR[a.slug]} />
                <text x={a.x * 1.1} y={a.y * 1.1} textAnchor="middle" dominantBaseline="middle" className="fill-black/70 font-bold" style={{ fontSize: 15 / cam.s }}>{a.label}</text>
              </g>
            ))}
            {points.map((p) => (
              <circle
                key={p.slug} className="node" cx={p.x} cy={p.y} r={(hover?.slug === p.slug ? p.rad + 3 : p.rad) / cam.s}
                fill={COLOR[p.topic] ?? COLOR.etc} fillOpacity={hover?.slug === p.slug ? 1 : 0.78}
                stroke={hover?.slug === p.slug ? "#fff" : "none"} strokeWidth={2 / cam.s}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover((h) => (h?.slug === p.slug ? null : h))}
                onClick={() => router.push(`/skills/${p.slug}`)}
              />
            ))}
          </g>
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
      <p className="mt-2 text-center text-xs text-black/40">앵커에 가까울수록 그 영역 · 두 분야 사이면 둘에 걸친 것 · 휠 확대/축소 · 빈 곳 끌어 이동 · 점 클릭 = 열기</p>
    </div>
  );
}

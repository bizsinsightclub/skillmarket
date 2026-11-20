"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

// 유사도 지도: 임베딩을 PCA로 2D 투영 → 점 사이 거리 = 실제 의미 유사도.
// 가까이 붙은 점 = 사실상 대체·중복 도구. 점을 누르면 최근접 이웃을 선으로 잇고 '비슷한 도구'를 목록으로 — 그게 보는 이유.
type Node = { slug: string; name: string; summary: string; topic: string; x: number; y: number; pop: number; near: { slug: string; sim: number }[] };
const COLOR: Record<string, string> = { doc: "#64748b", slides: "#f59e0b", data: "#0ea5e9", design: "#ec4899", dev: "#6366f1", automation: "#10b981", etc: "#94a3b8" };
const LABEL: Record<string, string> = { doc: "문서·글쓰기", slides: "슬라이드·발표", data: "데이터·분석", design: "디자인·이미지", dev: "개발", automation: "자동화·업무", etc: "기타" };

export default function PluginMap({ nodes }: { nodes: Node[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Node | null>(null);
  const [selSlug, setSelSlug] = useState<string | null>(null);
  const [cam, setCam] = useState({ s: 1, tx: 0, ty: 0 });

  const bySlug = useMemo(() => new Map(nodes.map((n) => [n.slug, n])), [nodes]);
  const sel = selSlug ? bySlug.get(selSlug) ?? null : null;
  const rad = (n: Node) => 3 + Math.sqrt(n.pop) * 1.6; // 인기(좋아요) → 크기
  // 선택 시 강조 대상 = 자신 + 이웃
  const lit = useMemo(() => {
    if (!sel) return null;
    const s = new Set<string>([sel.slug]);
    sel.near.forEach((x) => s.add(x.slug));
    return s;
  }, [sel]);

  // 커서 기준 휠 줌(네이티브 리스너라 preventDefault 가능)
  useEffect(() => {
    const svg = svgRef.current!;
    const toSvg = (cx: number, cy: number) => new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM()!.inverse());
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      setCam((c) => {
        const ns = Math.min(10, Math.max(0.6, c.s * (e.deltaY < 0 ? 1.15 : 0.87)));
        const wx = (p.x - c.tx) / c.s, wy = (p.y - c.ty) / c.s;
        return { s: ns, tx: p.x - wx * ns, ty: p.y - wy * ns };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // 배경 드래그 = 팬
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).classList.contains("node")) return;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const k = svgRef.current!.getScreenCTM()!.a || 1;
    if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 2) drag.current.moved = true;
    setCam((c) => ({ ...c, tx: c.tx + (e.clientX - drag.current!.x) / k, ty: c.ty + (e.clientY - drag.current!.y) / k }));
    drag.current = { ...drag.current, x: e.clientX, y: e.clientY };
  };
  const onUp = () => { if (drag.current && !drag.current.moved) setSelSlug(null); drag.current = null; }; // 빈 곳 클릭 = 선택 해제

  return (
    <div>
      <div className="relative h-[68vh] w-full overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_center,#fff,#f4f5f8)] ring-1 ring-black/5">
        <svg ref={svgRef} viewBox="-130 -130 260 260" className="h-full w-full touch-none" style={{ cursor: "grab" }} preserveAspectRatio="xMidYMid meet" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <g transform={`translate(${cam.tx} ${cam.ty}) scale(${cam.s})`}>
            {/* 선택 노드 → 이웃 연결선 */}
            {sel && sel.near.map((x) => {
              const b = bySlug.get(x.slug); if (!b) return null;
              return <line key={x.slug} x1={sel.x} y1={sel.y} x2={b.x} y2={b.y} stroke="#6366f1" strokeOpacity={0.25 + x.sim * 0.5} strokeWidth={1.2 / cam.s} />;
            })}
            {nodes.map((n) => {
              const dim = lit ? !lit.has(n.slug) : false;
              const on = sel?.slug === n.slug;
              return (
                <circle
                  key={n.slug} className="node" cx={n.x} cy={n.y} r={(hover?.slug === n.slug || on ? rad(n) + 2 : rad(n)) / cam.s}
                  fill={COLOR[n.topic] ?? COLOR.etc} fillOpacity={dim ? 0.12 : on ? 1 : 0.8}
                  stroke={on ? "#fff" : "none"} strokeWidth={2 / cam.s} style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover((h) => (h?.slug === n.slug ? null : h))}
                  onClick={() => setSelSlug(n.slug)}
                />
              );
            })}
          </g>
        </svg>
        {hover && !sel && (
          <div className="pointer-events-none absolute left-1/2 top-3 w-[min(90%,24rem)] -translate-x-1/2 rounded-2xl bg-ink/92 px-4 py-2 text-white shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold">{hover.name}</span>
              <span className="shrink-0 text-[11px] text-white/70">{LABEL[hover.topic]}{hover.pop ? ` · ♥ ${hover.pop}` : ""}</span>
            </div>
          </div>
        )}
      </div>

      {/* 아래 패널: 선택 전엔 범례+안내, 선택 후엔 '비슷한 도구' */}
      {sel ? (
        <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR[sel.topic] ?? COLOR.etc }} />
              <Link href={`/skills/${sel.slug}`} className="font-bold text-ink hover:underline">{sel.name}</Link>
              <span className="text-xs text-black/45">{LABEL[sel.topic]}{sel.pop ? ` · ♥ ${sel.pop}` : ""}</span>
            </div>
            <button onClick={() => setSelSlug(null)} className="text-xs font-medium text-black/40 hover:text-ink">선택 해제 ✕</button>
          </div>
          {sel.summary && <p className="mt-1 line-clamp-2 text-sm text-black/55">{sel.summary}</p>}
          <div className="mt-3 text-xs font-bold text-black/45">비슷한 도구</div>
          {sel.near.length ? (
            <ul className="mt-1 flex flex-col gap-1">
              {sel.near.map((x) => {
                const b = bySlug.get(x.slug); if (!b) return null;
                return (
                  <li key={x.slug} className="flex items-center gap-2 text-sm">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR[b.topic] ?? COLOR.etc }} />
                    <button onClick={() => setSelSlug(b.slug)} className="truncate font-medium text-ink hover:underline">{b.name}</button>
                    <span className="shrink-0 tabular-nums text-black/35">{Math.round(x.sim * 100)}%</span>
                    <Link href={`/skills/${b.slug}`} className="shrink-0 text-black/30 hover:text-sky-600" title="열기">↗</Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-1 text-sm text-black/40">가까운 유사 도구가 없어요 — 이 영역에선 독립적인 편.</p>}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-black/10 bg-white/50 px-4 py-3 text-xs text-black/55">
          {Object.entries(LABEL).map(([slug, label]) => (
            <span key={slug} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR[slug] }} />{label}
            </span>
          ))}
          <span className="ml-auto text-black/40">점 클릭 = 비슷한 도구 보기 · 크기 = 좋아요 · 휠 확대 · 끌어 이동</span>
        </div>
      )}
    </div>
  );
}

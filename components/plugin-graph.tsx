"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PLUGIN_TOPICS, topicLabel } from "@/lib/topics";

// 옵시디언 그래프 풍 스킬트리. 분야 허브(큰 점) + 플러그인(작은 점).
// rel(분야 관련도 0~1): 핵심일수록 허브에 바짝·점이 큼·연결선 진함. 호버=요약+관련도, 클릭=이동, 드래그=옮기기, 휠=줌.
type GNode = { slug: string; name: string; summary: string; topic: string; rel: number };
type Sim = { x: number; y: number; vx: number; vy: number; r: number; hub: boolean; topic: string; label: string; summary?: string; rel: number; slug?: string; fx?: number; fy?: number };

const COLOR: Record<string, string> = { doc: "#64748b", slides: "#f59e0b", data: "#0ea5e9", design: "#ec4899", dev: "#6366f1", automation: "#10b981", etc: "#94a3b8" };

export default function PluginGraph({ nodes, edges }: { nodes: GNode[]; edges: [number, number][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [hover, setHover] = useState<Sim | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const topics = PLUGIN_TOPICS.filter((t) => nodes.some((n) => n.topic === t.slug) || t.slug === "etc");

    const hubIdx: Record<string, number> = {};
    const sim: Sim[] = [];
    const E: [number, number][] = [];
    topics.forEach((t, k) => {
      const a = (k / topics.length) * Math.PI * 2;
      hubIdx[t.slug] = sim.length;
      sim.push({ x: Math.cos(a) * 320, y: Math.sin(a) * 320, vx: 0, vy: 0, r: 14, hub: true, topic: t.slug, label: t.label, rel: 1 });
    });
    nodes.forEach((n) => {
      const h = sim[hubIdx[n.topic] ?? hubIdx.etc];
      sim.push({ x: (h?.x ?? 0) + (Math.random() - 0.5) * 80, y: (h?.y ?? 0) + (Math.random() - 0.5) * 80, vx: 0, vy: 0, r: 4 + n.rel * 4, hub: false, topic: n.topic, label: n.name, summary: n.summary, rel: n.rel, slug: n.slug });
      E.push([hubIdx[n.topic] ?? hubIdx.etc, sim.length - 1]);
    });
    const base = topics.length;
    for (const [a, b] of edges) E.push([base + a, base + b]);

    const cam = { x: 0, y: 0, scale: 0.85 };
    let alpha = 1, raf = 0;
    let dragNode: Sim | null = null, panning = false, last = { x: 0, y: 0 }, hoverNode: Sim | null = null;

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cam.x = w / 2; cam.y = h / 2;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function step() {
      for (let i = 0; i < sim.length; i++) for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i], b = sim[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const f = (a.hub && b.hub ? 45000 : a.hub || b.hub ? 2600 : 1400) / d2; // 허브끼리 강하게 밀어 벌린다
        const d = Math.sqrt(d2); dx /= d; dy /= d;
        a.vx += dx * f * alpha; a.vy += dy * f * alpha;
        b.vx -= dx * f * alpha; b.vy -= dy * f * alpha;
      }
      for (const [i, j] of E) {
        const a = sim[i], b = sim[j];
        const node = a.hub ? b : b.hub ? a : null;
        const rest = node ? 50 + (1 - node.rel) * 130 : 60; // 관련도 높을수록 허브에 바짝
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - rest) * (node ? 0.035 : 0.02) * alpha;
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
      for (const n of sim) {
        const g = n.hub ? 0.0006 : 0.0016;
        n.vx += -n.x * g * alpha; n.vy += -n.y * g * alpha;
        n.vx *= 0.82; n.vy *= 0.82;
        if (n === dragNode && n.fx != null) { n.x = n.fx; n.y = n.fy!; n.vx = n.vy = 0; }
        else { n.x += n.vx; n.y += n.vy; }
      }
      alpha *= 0.992;
    }

    function draw() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cam.x, cam.y); ctx.scale(cam.scale, cam.scale);
      ctx.lineWidth = 1 / cam.scale;
      for (const [i, j] of E) {
        const a = sim[i], b = sim[j];
        if (a.hub || b.hub) { const node = a.hub ? b : a; ctx.strokeStyle = `rgba(30,30,40,${0.03 + node.rel * 0.11})`; } // 관련도 높을수록 또렷
        else ctx.strokeStyle = "rgba(99,102,241,0.07)"; // 유사도선은 옅게
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const n of sim) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = COLOR[n.topic] ?? COLOR.etc;
        ctx.globalAlpha = n.hub ? 1 : 0.55 + n.rel * 0.45; // 관련도 낮으면 흐릿
        ctx.fill();
        if (n === hoverNode) { ctx.globalAlpha = 1; ctx.lineWidth = 2.5 / cam.scale; ctx.strokeStyle = "#fff"; ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (n.hub) {
          ctx.fillStyle = "#1a1a1a"; ctx.font = `700 ${13 / cam.scale}px Pretendard, sans-serif`;
          ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y - n.r - 5);
        }
      }
      ctx.restore();
    }

    function tick() { step(); draw(); raf = requestAnimationFrame(tick); }
    tick();

    function toWorld(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left - cam.x) / cam.scale, y: (e.clientY - rect.top - cam.y) / cam.scale };
    }
    function pick(e: PointerEvent) {
      const w = toWorld(e);
      let best: Sim | null = null, bd = Infinity;
      for (const n of sim) { const d = Math.hypot(n.x - w.x, n.y - w.y); if (d < n.r + 6 / cam.scale && d < bd) { bd = d; best = n; } }
      return best;
    }

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const n = pick(e);
      if (n) { dragNode = n; const w = toWorld(e); n.fx = w.x; n.fy = w.y; alpha = Math.max(alpha, 0.5); }
      else { panning = true; last = { x: e.clientX, y: e.clientY }; }
    };
    const onMove = (e: PointerEvent) => {
      if (dragNode) { const w = toWorld(e); dragNode.fx = w.x; dragNode.fy = w.y; alpha = Math.max(alpha, 0.3); return; }
      if (panning) { cam.x += e.clientX - last.x; cam.y += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; return; }
      const n = pick(e); hoverNode = n; setHover(n);
      canvas.style.cursor = n ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      if (dragNode) {
        const moved = Math.hypot((dragNode.fx ?? 0) - dragNode.x, (dragNode.fy ?? 0) - dragNode.y);
        if (moved < 3 && dragNode.slug) router.push(`/skills/${dragNode.slug}`);
        else if (moved < 3 && dragNode.hub) router.push(`/plugins?topic=${dragNode.topic}`);
        dragNode.fx = dragNode.fy = undefined;
      }
      dragNode = null; panning = false;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; cam.scale = Math.min(3, Math.max(0.3, cam.scale * f)); };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, edges, router]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="h-[72vh] w-full touch-none rounded-3xl bg-[radial-gradient(circle_at_center,#fff,#f4f5f8)] ring-1 ring-black/5" style={{ cursor: "grab" }} />
      {hover && !hover.hub && (
        <div className="pointer-events-none absolute left-1/2 top-3 w-[min(90%,22rem)] -translate-x-1/2 rounded-2xl bg-ink/92 px-4 py-2.5 text-white shadow-lg">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold">{hover.label}</span>
            <span className="shrink-0 text-[11px] text-white/70">{topicLabel(hover.topic)} {Math.round(hover.rel * 100)}%</span>
          </div>
          {hover.summary && <p className="mt-0.5 line-clamp-2 text-xs text-white/70">{hover.summary}</p>}
        </div>
      )}
      <p className="mt-2 text-center text-xs text-black/40">점 클릭 = 열기 · 끌어서 옮기기 · 휠 확대/축소 · 빈 곳 끌어 이동 · 허브에 가깝고 큰 점일수록 그 분야에 핵심</p>
    </div>
  );
}

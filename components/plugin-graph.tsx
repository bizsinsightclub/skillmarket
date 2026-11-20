"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PLUGIN_TOPICS } from "@/lib/topics";

// 옵시디언 그래프 풍 스킬트리. 분야 허브(큰 점) + 플러그인(작은 점), 허브로 묶이고 유사도로 연결.
// 캔버스 포스 레이아웃 직접 구현(의존성 없음). 호버=이름, 클릭=이동, 드래그=옮기기(고정), 휠=줌.
type GNode = { slug: string; name: string; topic: string };
type Sim = { x: number; y: number; vx: number; vy: number; r: number; hub: boolean; topic: string; label: string; slug?: string; fx?: number; fy?: number };

const COLOR: Record<string, string> = { doc: "#64748b", slides: "#f59e0b", data: "#0ea5e9", design: "#ec4899", dev: "#6366f1", automation: "#10b981", etc: "#94a3b8" };

export default function PluginGraph({ nodes, edges }: { nodes: GNode[]; edges: [number, number][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [hover, setHover] = useState<Sim | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const topics = PLUGIN_TOPICS.filter((t) => nodes.some((n) => n.topic === t.slug) || t.slug === "etc");

    // 허브(분야) + 플러그인 노드. 허브는 원형으로 초기 배치, 플러그인은 자기 허브 근처.
    const hubIdx: Record<string, number> = {};
    const sim: Sim[] = [];
    const E: [number, number][] = [];
    topics.forEach((t, k) => {
      const a = (k / topics.length) * Math.PI * 2;
      hubIdx[t.slug] = sim.length;
      sim.push({ x: Math.cos(a) * 180, y: Math.sin(a) * 180, vx: 0, vy: 0, r: 13, hub: true, topic: t.slug, label: t.label });
    });
    nodes.forEach((n) => {
      const h = sim[hubIdx[n.topic] ?? hubIdx.etc];
      sim.push({ x: (h?.x ?? 0) + (Math.random() - 0.5) * 60, y: (h?.y ?? 0) + (Math.random() - 0.5) * 60, vx: 0, vy: 0, r: 5, hub: false, topic: n.topic, label: n.name, slug: n.slug });
      E.push([hubIdx[n.topic] ?? hubIdx.etc, sim.length - 1]); // 허브 결속
    });
    const base = topics.length;
    for (const [a, b] of edges) E.push([base + a, base + b]); // 유사도

    const cam = { x: 0, y: 0, scale: 1 };
    let alpha = 1;
    let raf = 0;
    let dragNode: Sim | null = null;
    let panning = false;
    let last = { x: 0, y: 0 };
    let hoverNode: Sim | null = null;

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
      // 반발
      for (let i = 0; i < sim.length; i++) for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i], b = sim[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = (a.hub && b.hub ? 9000 : 1600) / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * f * alpha; a.vy += dy * f * alpha;
        b.vx -= dx * f * alpha; b.vy -= dy * f * alpha;
      }
      // 스프링
      for (const [i, j] of E) {
        const a = sim[i], b = sim[j];
        const rest = a.hub || b.hub ? 70 : 55;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - rest) * 0.03 * alpha;
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
      // 중심 중력 + 감쇠 + 적용
      for (const n of sim) {
        n.vx += -n.x * 0.002 * alpha; n.vy += -n.y * 0.002 * alpha;
        n.vx *= 0.82; n.vy *= 0.82;
        if (n === dragNode && n.fx != null) { n.x = n.fx; n.y = n.fy!; n.vx = n.vy = 0; }
        else { n.x += n.vx; n.y += n.vy; }
      }
      alpha *= 0.992; // 서서히 식어 멈춘다(드래그·줌 때 다시 데움)
    }

    function draw() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cam.x, cam.y); ctx.scale(cam.scale, cam.scale);
      // 엣지
      ctx.lineWidth = 1 / cam.scale;
      for (const [i, j] of E) {
        const a = sim[i], b = sim[j];
        ctx.strokeStyle = a.hub || b.hub ? "rgba(0,0,0,0.12)" : "rgba(99,102,241,0.18)";
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // 노드
      for (const n of sim) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = COLOR[n.topic] ?? COLOR.etc;
        ctx.globalAlpha = n.hub ? 1 : 0.9;
        ctx.fill();
        if (n === hoverNode) { ctx.globalAlpha = 1; ctx.lineWidth = 2 / cam.scale; ctx.strokeStyle = "#fff"; ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (n.hub) {
          ctx.fillStyle = "#1a1a1a"; ctx.font = `700 ${13 / cam.scale}px Pretendard, sans-serif`;
          ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y - n.r - 4);
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
      if (dragNode) { const moved = Math.hypot((dragNode.fx ?? 0) - dragNode.x, (dragNode.fy ?? 0) - dragNode.y); dragNode.fx = dragNode.fy = undefined; if (moved < 3 && dragNode.slug) router.push(`/skills/${dragNode.slug}`); else if (moved < 3 && dragNode.hub) router.push(`/plugins?topic=${dragNode.topic}`); }
      dragNode = null; panning = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      cam.scale = Math.min(3, Math.max(0.3, cam.scale * f));
    };
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
      <canvas ref={canvasRef} className="h-[70vh] w-full touch-none rounded-3xl bg-[radial-gradient(circle_at_center,#fff,#f4f5f8)] ring-1 ring-black/5" style={{ cursor: "grab" }} />
      {hover && !hover.hub && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink/90 px-3 py-1 text-xs font-medium text-white">{hover.label}</div>
      )}
      <p className="mt-2 text-center text-xs text-black/40">점 클릭 = 열기 · 끌어서 옮기기 · 휠 확대/축소 · 빈 곳 끌어 이동</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "./skill-card";

export type Pick = {
  slug: string;
  name: string;
  summary: string;
  thumb: string | null;
  category_label: string;
  byline: string;
  likes: number;
  installs: number | null; // null = 내려받기 없는 링크형(플러그인·MCP)
};

const INTERVAL_MS = 6000;

// 홈 가운데: 에디터 픽(최근 선정 순 — 새로 검수 통과한 스킬이 앞에)을 하나씩 돌아가며 조명.
// 호버·포커스·탭 숨김·'동작 줄이기' 설정이면 멈춘다.
export default function PickSpotlight({ picks }: { picks: Pick[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = picks.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  useEffect(() => {
    if (paused || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setI((x) => (x + 1) % n);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  const p = picks[i];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="에디터 픽"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#1a1a1f,#202027)] p-4 text-white sm:p-6"
    >
      {/* 현재 슬라이드 이미지를 크게 흐려 깐 은은한 배경 (전환 시 블러 애니메이션 없음) */}
      {p.thumb && <img key={p.thumb} src={`/files/${p.thumb}`} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-20 blur-3xl" />}

      <div key={p.slug} className="grid items-center gap-6 motion-safe:animate-[spot-in_.5s_ease-out] md:grid-cols-[1.25fr_1fr] md:gap-10">
        <Link href={`/skills/${p.slug}`} className="block overflow-hidden rounded-2xl ring-1 ring-white/10">
          <div className="aspect-[16/10]">
            {p.thumb ? (
              <img src={`/files/${p.thumb}`} alt={`${p.name} 미리보기`} className="h-full w-full object-cover" />
            ) : (
              <Cover slug={p.slug} name={p.name} category={p.category_label} />
            )}
          </div>
        </Link>

        <div className="px-1 pb-2 md:pr-6">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-accent px-2.5 py-1 text-ink">✦ 에디터 픽</span>
            <span className="text-white/50">{p.category_label}</span>
            <span className="ml-auto tabular-nums text-white/40" aria-live="polite">{i + 1} / {n}</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">{p.name}</h2>
          <p className="mt-3 line-clamp-3 text-white/70">{p.summary}</p>
          <p className="mt-4 text-sm text-white/50">
            {p.byline}
            <span className="ml-3 tabular-nums">♥ {p.likes}{p.installs !== null && ` · ↓ ${p.installs}`}</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <Link href={`/skills/${p.slug}`} className="rounded-xl bg-accent px-5 py-2.5 font-bold text-ink">자세히 보기</Link>
            <Link href="/picks" className="rounded-xl bg-white/10 px-5 py-2.5 font-bold ring-1 ring-white/20 hover:bg-white/15">에디터 픽 전체</Link>
          </div>
        </div>
      </div>

      {n > 1 && (
        <div className="mt-5 flex items-center justify-between gap-4 px-1">
          <div className="flex flex-wrap gap-1.5">
            {picks.map((x, k) => (
              <button
                key={x.slug}
                onClick={() => setI(k)}
                aria-label={`${k + 1}번째: ${x.name}`}
                aria-current={k === i}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-7 bg-accent" : "w-3 bg-white/25 hover:bg-white/45"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => go(-1)} aria-label="이전" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/20">←</button>
            <button onClick={() => go(1)} aria-label="다음" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/20">→</button>
          </div>
        </div>
      )}
    </section>
  );
}

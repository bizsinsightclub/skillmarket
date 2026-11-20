"use client";

import { useState } from "react";
import AskChat from "@/components/ask-chat";

// 우측 하단 'ai guide' 버튼 → 누르면 버튼 위에 대화창이 펼쳐진다(별도 페이지로 안 감).
export default function AskWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fixed bottom-28 right-4 z-40 flex w-[min(92vw,24rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 sm:right-6">
          <div className="flex items-center justify-between bg-indigo-600 px-4 py-3 text-white">
            <span className="flex items-center gap-2 font-bold">
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H5a2 2 0 0 1-2-2V5Z" /><path d="M8 8h4M8 10.5h2" /></svg>
              AI 가이드
            </span>
            <button onClick={() => setOpen(false)} aria-label="닫기" className="rounded-full p-1 hover:bg-white/20">
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
          <div className="p-3">
            <AskChat />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="AI 가이드 — 원하는 스킬 찾기"
        className="fixed bottom-6 right-6 z-40 flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-1 ring-white/20 transition hover:scale-105 hover:bg-indigo-700"
      >
        {open ? (
          <svg aria-hidden viewBox="0 0 20 20" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
        ) : (
          <>
            <svg aria-hidden viewBox="0 0 20 20" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H5a2 2 0 0 1-2-2V5Z" /><path d="M8 8h4M8 10.5h2" /></svg>
            <span className="text-[11px] font-bold leading-none tracking-wide">ai guide</span>
          </>
        )}
      </button>
    </>
  );
}

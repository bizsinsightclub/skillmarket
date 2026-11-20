import Link from "next/link";

// 우측 하단 고정 플로팅 버튼 → AI 추천 챗봇(/ask). 원형, 아이콘(로고) 밑에 'ai guide' 라벨.
export default function AskFab() {
  return (
    <Link
      href="/ask"
      aria-label="AI 가이드 — 원하는 스킬 찾기"
      className="fixed bottom-6 right-6 z-40 flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-1 ring-white/20 transition hover:scale-105 hover:bg-indigo-700"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H5a2 2 0 0 1-2-2V5Z" />
        <path d="M8 8h4M8 10.5h2" />
      </svg>
      <span className="text-[11px] font-bold leading-none tracking-wide">ai guide</span>
    </Link>
  );
}

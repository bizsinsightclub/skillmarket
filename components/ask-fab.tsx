import Link from "next/link";

// 우측 하단 고정 플로팅 버튼 → AI 추천 챗봇(/ask). 아이콘 상시, 호버하면 라벨이 펼쳐진다.
export default function AskFab() {
  return (
    <Link
      href="/ask"
      aria-label="AI에게 물어보기"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20 transition hover:bg-indigo-700 sm:bottom-6 sm:right-6"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H5a2 2 0 0 1-2-2V5Z" />
        <path d="M8 8h4M8 10.5h2" />
      </svg>
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm opacity-0 transition-all duration-200 group-hover:max-w-[9rem] group-hover:opacity-100">AI에게 물어보기</span>
    </Link>
  );
}

import Link from "next/link";

// 헤더 로고 옆 메뉴 상자. 메뉴마다 고유 색·아이콘으로 구분한다(스킬 라임 · 플러그인 하늘 · 전문가 퍼플 · HTML 앱 에메랄드 · AI Breakthrough 앰버). (에디터 픽은 홈 조명이 맡아 메뉴에서 뺐다)
// 현재 위치는 페이지가 그린 <span hidden data-tab="…"> 표식을 globals.css 의 :has() 가 읽어 꽉 찬 색으로 칠한다(JS 없음).
const MENU = [
  {
    href: "/skills", label: "스킬", cls: "menu-skills bg-accent/40 text-ink hover:bg-accent/70",
    icon: <><path d="M10 2 2 6l8 4 8-4-8-4Z" /><path d="m2 10 8 4 8-4" /><path d="m2 14 8 4 8-4" /></>,
  },
  {
    href: "/plugins", label: "플러그인·MCP", cls: "menu-plugins bg-sky-100 text-sky-800 hover:bg-sky-200",
    icon: <><path d="M7 2v4M13 2v4" /><path d="M5 6h10v3a5 5 0 0 1-10 0V6Z" /><path d="M10 14v4" /></>,
  },
  {
    href: "/experts", label: "전문가", cls: "menu-experts bg-lens-bg text-lens-deep hover:bg-[#e3d8fd]",
    icon: <><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" /></>,
  },
  {
    href: "/apps", label: "HTML 앱", cls: "menu-apps bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    icon: <><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><path d="M2.5 7.5h15" /><path d="m8 10.5-2 1.75L8 14M12 10.5l2 1.75L12 14" /></>,
  },
  {
    href: "/board", label: "AI Breakthrough", cls: "menu-board bg-amber-100 text-amber-800 hover:bg-amber-200",
    icon: <><path d="M11 2 4 11h5l-1 7 7-9h-5l1-7Z" /></>,
  },
];

export default function NavMenu() {
  return (
    // 휴대폰에선 헤더 아래 둘째 줄(넘치면 옆으로 밀기), md 부터 로고 옆
    <div className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-2xl [scrollbar-width:none] bg-white/80 p-1 shadow-[0_2px_10px_-4px_rgb(0_0_0/0.15)] ring-1 ring-black/5 md:order-none md:w-auto">
      {MENU.map((m) => (
        <Link key={m.href} href={m.href} title={m.label} className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold transition-colors ${m.cls}`}>
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
            {m.icon}
          </svg>
          {/* md~lg 사이(로고 옆에 끼는 폭)에선 아이콘만, 휴대폰 둘째 줄과 넓은 화면에선 이름까지 */}
          <span className="md:max-lg:hidden">{m.label}</span>
        </Link>
      ))}
    </div>
  );
}

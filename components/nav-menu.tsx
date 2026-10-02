import Link from "next/link";

// 헤더 오른쪽 끝 메뉴 상자. 메뉴마다 고유 색·아이콘으로 구분한다.
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
    href: "/picks", label: "에디터 픽", cls: "menu-picks bg-amber-100 text-amber-800 hover:bg-amber-200",
    icon: <path d="M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />,
  },
];

export default function NavMenu() {
  return (
    <div className="hidden items-center gap-1 rounded-2xl bg-white/80 p-1 shadow-[0_2px_10px_-4px_rgb(0_0_0/0.15)] ring-1 ring-black/5 md:flex">
      {MENU.map((m) => (
        <Link key={m.href} href={m.href} title={m.label} className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold transition-colors ${m.cls}`}>
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
            {m.icon}
          </svg>
          {/* 좁은 화면에선 아이콘만 */}
          <span className="hidden lg:inline">{m.label}</span>
        </Link>
      ))}
    </div>
  );
}

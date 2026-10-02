import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { PAGE_SIZE, listBoard, listCategories, type Kind, type Sort, type Tab } from "@/lib/queries";
import { SkillGrid } from "@/components/skill-card";

const TABS: [Tab, string][] = [["all", "전체"], ["pick", "에디터 픽"]];
const SORTS: [Sort, string][] = [["latest", "최신"], ["trending", "트렌딩"], ["popular", "인기"]];

function pick<T extends string>(raw: unknown, allowed: [T, string][], fallback: T): T {
  return allowed.some(([k]) => k === raw) ? (raw as T) : fallback;
}

type SP = Record<string, string | string[] | undefined>;

// /skills(스킬), /plugins(플러그인·MCP), /picks(에디터 픽 전체) 가 같이 쓰는 목록 화면
const UPLOAD: Record<Kind, [string, string]> = { skill: ["/write", "스킬 올리기"], link: ["/write?category=plugin", "추천하기"], lens: ["/write?category=expert", "렌즈 올리기"] };

export default async function Catalog({ base, title, kind, onlyPicks = false, intro, sp }: { base: string; title: string; kind?: Kind; onlyPicks?: boolean; intro?: React.ReactNode; sp: SP }) {
  const { viewer } = await requireViewer();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tab: Tab = onlyPicks ? "pick" : pick(sp.tab, TABS, "all");
  const sorts: [Sort, string][] = onlyPicks ? [["picked", "최근 선정"], ...SORTS] : SORTS;
  const sort = pick(sp.sort, sorts, onlyPicks ? "picked" : "latest");
  const category = str("category");
  const q = str("q");
  const page = Math.max(1, Number(str("page")) || 1);

  const db = getDb();
  const [categories, { rows, total }] = await Promise.all([listCategories(db, kind), listBoard(db, viewer, { tab, kind, sort, category, q, page })]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams({ tab, sort, category, q, page: String(page), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) });
    const defaultSort = onlyPicks ? "picked" : "latest";
    for (const [k, v] of [...p]) if (!v || (k === "tab" && (v === "all" || onlyPicks)) || (k === "sort" && v === defaultSort) || (k === "page" && v === "1")) p.delete(k);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const on = kind === "lens" ? "bg-lens text-white" : "bg-ink text-white"; // 전문가 탭은 The Lens 퍼플로 구분
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? on : "glass text-black/70 hover:text-ink"}`;

  return (
    <div>
      {intro}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{q ? `“${q}” 검색 결과` : title}</h1>
          <p className="mt-1 text-sm text-black/50">
            {total}개
            {q && kind === "skill" && <> · <Link href={`/plugins?q=${encodeURIComponent(q)}`} className="underline">플러그인·MCP 에서도 찾기</Link></>}
            {q && kind === "link" && <> · <Link href={`/skills?q=${encodeURIComponent(q)}`} className="underline">스킬에서도 찾기</Link></>}
          </p>
        </div>
        {!onlyPicks && (
          <div className="flex items-center gap-2">
          {kind && <Link href={UPLOAD[kind][0]} className={`rounded-xl px-4 py-2 text-sm font-bold hover:opacity-90 ${on}`}>{UPLOAD[kind][1]}</Link>}
          <div className="glass flex gap-1 rounded-2xl p-1">
            {TABS.map(([k, label]) => (
              <Link key={k} href={href({ tab: k, page: 1 })} className={`rounded-xl px-4 py-1.5 text-sm font-semibold ${tab === k ? on : "text-black/60 hover:text-ink"}`}>
                {label}
              </Link>
            ))}
          </div>
          </div>
        )}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <Link href={href({ category: "", page: 1 })} className={chip(!category)}>전체 분류</Link>
        {categories.map((c) => (
          <Link key={c.slug} href={href({ category: c.slug, page: 1 })} className={chip(category === c.slug)}>{c.label}</Link>
        ))}
        <div className="ml-auto flex gap-1 text-sm">
          {sorts.map(([k, label]) => (
            <Link key={k} href={href({ sort: k, page: 1 })} className={`rounded-full px-3 py-1.5 ${sort === k ? `font-bold ${kind === "lens" ? "text-lens-deep" : "text-ink"}` : "text-black/50 hover:text-ink"}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <SkillGrid rows={rows} empty={q ? "검색 결과가 없습니다" : undefined} />

      {pages > 1 && (
        <nav className="mt-12 flex justify-center gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} className={`grid h-9 w-9 place-items-center rounded-full font-semibold ${n === page ? on : "glass"}`}>{n}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}

import Link from "next/link";
import { getDb } from "@/lib/db";
import { isEditor, requireUser } from "@/lib/auth";
import BoardTable from "@/components/board-table";
import { PAGE_SIZE, listBoard, listCategories, type Sort, type Tab } from "@/lib/queries";

const TABS: [Tab, string][] = [["all", "전체"], ["curated", "큐레이티드"], ["pick", "에디터 픽"]];
const SORTS: [Sort, string][] = [["latest", "최신"], ["trending", "트렌딩"], ["popular", "인기"]];

function pick<T extends string>(raw: unknown, allowed: [T, string][], fallback: T): T {
  return allowed.some(([k]) => k === raw) ? (raw as T) : fallback;
}

export default async function BoardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tab = pick(sp.tab, TABS, "all");
  const sort = pick(sp.sort, SORTS, "latest");
  const category = str("category");
  const q = str("q");
  const page = Math.max(1, Number(str("page")) || 1);

  const db = getDb();
  const [categories, { rows, total }] = await Promise.all([listCategories(db), listBoard(db, { id: user.id, email: user.email, editor: isEditor(user) }, { tab, sort, category, q, page })]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams({ tab, sort, category, q, page: String(page), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) });
    for (const [k, v] of [...p]) if (!v || (k === "tab" && v === "all") || (k === "sort" && v === "latest") || (k === "page" && v === "1")) p.delete(k);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-black/10">
        {TABS.map(([k, label]) => (
          <Link key={k} href={href({ tab: k, page: 1 })} className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === k ? "border-black font-bold" : "border-transparent text-black/50"}`}>
            {label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        <select name="category" defaultValue={category} className="rounded border px-2 py-1.5">
          <option value="">전체 분류</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className="rounded border px-2 py-1.5">
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="제목·설명·태그 검색" className="w-60 rounded border px-3 py-1.5" />
        <button className="rounded bg-black px-3 py-1.5 text-white">검색</button>
        <span className="ml-auto text-black/50">총 {total}개</span>
      </form>

      <BoardTable rows={rows} firstNumber={total - (page - 1) * PAGE_SIZE} />

      <div className="mt-6 flex items-center justify-between">
        <nav className="flex gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} className={`rounded px-2.5 py-1 ${n === page ? "bg-black text-white" : "hover:bg-black/5"}`}>{n}</Link>
          ))}
        </nav>
        <Link href="/write" className="rounded bg-black px-4 py-2 text-sm text-white">글쓰기</Link>
      </div>
    </div>
  );
}

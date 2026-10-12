import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { authorStats, listBoard, PAGE_SIZE } from "@/lib/queries";
import { SkillGrid } from "@/components/skill-card";

// 만든 글과 추천한 글(외부 플러그인·MCP·오픈소스, 웹에서 가져온 공개 스킬)을 나눠 보여 준다 — 추천한 것을 직접 만든 것처럼 보이지 않게.
export default async function AuthorPage({ params, searchParams }: PageProps<"/u/[email]">) {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { viewer } = await requireViewer();
  const db = getDb();
  const stats = await authorStats(db, viewer, email);
  if (!stats.made && !stats.recs) notFound();
  const rec = sp.show === "rec" || !stats.made;
  const { rows, total } = await listBoard(db, viewer, { author: email, made: !rec, page });
  const pages = Math.ceil(total / PAGE_SIZE);
  const tab = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold ${on ? "bg-ink text-white" : "glass text-black/60 hover:text-ink"}`;
  return (
    <div>
      <div className="glass mb-8 flex flex-wrap items-center gap-6 rounded-3xl p-8">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-2xl font-bold text-accent">{stats.name?.[0]}</span>
        <div className="mr-auto">
          <h1 className="text-3xl font-extrabold tracking-[-0.03em]">{stats.name}</h1>
          <p className="text-sm text-black/50">{email}</p>
        </div>
        {stats.made > 0 && [["만든 글", stats.made], ["받은 좋아요", stats.likes], ["받아 간 사람", stats.installs], ["써봤어요", stats.uses]].map(([label, n]) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-extrabold tabular-nums tracking-tight">{n}</div>
            <div className="text-xs text-black/50">{label}</div>
          </div>
        ))}
      </div>
      <nav className="mb-6 flex min-h-9 flex-wrap items-center gap-2">
        {stats.made > 0 && <Link href="?" className={tab(!rec)}>만든 글 {stats.made}</Link>}
        {stats.recs > 0 && <Link href="?show=rec" className={tab(rec)}>추천한 글 {stats.recs}</Link>}
        {rec && <p className="ml-2 text-sm text-black/50">다른 곳에서 만든 플러그인·MCP·오픈소스·스킬을 소개한 글입니다.</p>}
      </nav>
      <SkillGrid rows={rows} />
      {pages > 1 && (
        <nav className="mt-12 flex justify-center gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={`?${rec ? "show=rec&" : ""}page=${n}`} className={`grid h-9 w-9 place-items-center rounded-full font-semibold ${n === page ? "bg-ink text-white" : "glass"}`}>{n}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}

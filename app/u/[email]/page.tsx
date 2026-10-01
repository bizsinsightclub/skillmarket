import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { authorStats, listBoard, PAGE_SIZE } from "@/lib/queries";
import { SkillGrid } from "@/components/skill-card";

export default async function AuthorPage({ params, searchParams }: PageProps<"/u/[email]">) {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { viewer } = await requireViewer();
  const db = getDb();
  const stats = await authorStats(db, viewer, email);
  if (!stats.skills) notFound();
  const { rows, total } = await listBoard(db, viewer, { author: email, page });
  const pages = Math.ceil(total / PAGE_SIZE);
  return (
    <div>
      <div className="glass mb-12 flex flex-wrap items-center gap-6 rounded-3xl p-8">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-2xl font-bold text-accent">{stats.name?.[0]}</span>
        <div className="mr-auto">
          <h1 className="text-3xl font-extrabold tracking-[-0.03em]">{stats.name}</h1>
          <p className="text-sm text-black/50">{email}</p>
        </div>
        {[["스킬", stats.skills], ["받은 좋아요", stats.likes], ["설치", stats.installs]].map(([label, n]) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-extrabold tabular-nums tracking-tight">{n}</div>
            <div className="text-xs text-black/50">{label}</div>
          </div>
        ))}
      </div>
      <SkillGrid rows={rows} />
      {pages > 1 && (
        <nav className="mt-12 flex justify-center gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={`?page=${n}`} className={`grid h-9 w-9 place-items-center rounded-full font-semibold ${n === page ? "bg-ink text-white" : "glass"}`}>{n}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { authorStats, listBoard, PAGE_SIZE } from "@/lib/queries";
import BoardTable from "@/components/board-table";

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
      <h1 className="text-2xl font-bold">{stats.name}</h1>
      <p className="mb-4 text-sm text-black/60">{email}</p>
      <div className="mb-6 flex gap-8 text-sm">
        <div><span className="text-2xl font-bold">{stats.skills}</span> 스킬</div>
        <div><span className="text-2xl font-bold">{stats.likes}</span> 받은 좋아요</div>
        <div><span className="text-2xl font-bold">{stats.installs}</span> 설치</div>
      </div>
      <BoardTable rows={rows} firstNumber={total - (page - 1) * PAGE_SIZE} />
      {pages > 1 && (
        <nav className="mt-6 flex gap-1 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={`?page=${n}`} className={`rounded px-2.5 py-1 ${n === page ? "bg-black text-white" : "hover:bg-black/5"}`}>{n}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}

import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { hallOfFame } from "@/lib/queries";

// 명예의 전당: 동료가 받아 가고 써본 스킬의 원작자. 전사 공개·검수 승인된 글만, 본인 다운로드·중복은 빼고 센다.
function Board({ title, rows }: { title: string; rows: Awaited<ReturnType<typeof hallOfFame>> }) {
  return (
    <section className="panel rounded-3xl p-6 sm:p-8">
      <h2 className="mb-4 text-lg font-extrabold tracking-[-0.02em]">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-black/45">아직 기록이 없습니다</p>
      ) : (
        <ol className="divide-y divide-black/5">
          {rows.map((r) => (
            <li key={r.author_email}>
              <Link href={`/u/${encodeURIComponent(r.author_email)}`} className="flex items-center gap-3 py-3 hover:underline">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-accent">{r.author_name[0]}</span>
                <span className="mr-auto min-w-0 truncate font-semibold">{r.author_name}</span>
                <span className="shrink-0 text-sm tabular-nums text-black/60">받아 감 {r.installs} · 써봤어요 {r.uses} · 글 {r.skills}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function HallPage() {
  await requireViewer();
  const db = getDb();
  const [month, all] = await Promise.all([hallOfFame(db, { days: 30, limit: 20 }), hallOfFame(db, { limit: 20 })]);
  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em]">명예의 전당</h1>
      <p className="mb-8 mt-1 text-sm text-black/50">동료가 받아 가고 써본 스킬의 원작자. 받아 감은 사람당 한 번, 본인은 세지 않습니다.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Board title="최근 30일" rows={month} />
        <Board title="전체" rows={all} />
      </div>
    </div>
  );
}

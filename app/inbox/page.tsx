import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { listNotices } from "@/lib/queries";

// 알림함: 내 글의 검수 결과·좋아요·댓글, 내 댓글에 달린 답글. 열면 '읽음' 시각을 갱신해 헤더 배지가 사라진다.
export default async function InboxPage() {
  const user = await requireUser();
  const db = getDb();
  const seen = (await db.query<{ inbox_seen_at: Date }>("SELECT inbox_seen_at FROM app.users WHERE id = $1", [user.id]))[0]?.inbox_seen_at;
  const notices = await listNotices(db, user.id);
  await db.query("UPDATE app.users SET inbox_seen_at = now() WHERE id = $1", [user.id]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-extrabold tracking-[-0.03em]">알림함</h1>
      {notices.length === 0 ? (
        <p className="glass rounded-2xl py-16 text-center text-black/50">아직 알림이 없습니다. 내 글에 검수 결과·좋아요·댓글이 생기면 여기에 모입니다.</p>
      ) : (
        <ul className="panel divide-y divide-black/5 overflow-hidden rounded-2xl">
          {notices.map((n, i) => {
            const fresh = seen && n.created_at > seen;
            return (
              <li key={i} className={`flex gap-3 px-5 py-4 text-sm ${fresh ? "bg-accent/15" : ""}`}>
                <span className="mt-0.5 text-base" aria-hidden>{n.kind === "like" ? "♥" : n.kind === "comment" || n.kind === "reply" ? "💬" : n.decision === "approved" ? "✦" : "↩"}</span>
                <div className="min-w-0 flex-1">
                  <p>
                    {n.kind === "like" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 에 좋아요를 눌렀습니다.</>
                    ) : n.kind === "comment" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 에 댓글을 남겼습니다.</>
                    ) : n.kind === "reply" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 의 내 댓글에 답글을 남겼습니다.</>
                    ) : n.decision === "approved" ? (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> 이(가) 에디터 픽으로 선정됐습니다. <span className="text-black/50">({n.actor})</span></>
                    ) : (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> 검수가 반려됐습니다. <span className="text-black/50">({n.actor})</span></>
                    )}
                  </p>
                  {n.kind === "review" && n.note && <p className="mt-1 text-black/60">“{n.note}”</p>}
                  <p className="mt-1 text-xs text-black/40">{fmtDate(n.created_at, true)}</p>
                </div>
                {fresh && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="새 알림" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

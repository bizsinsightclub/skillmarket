import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { listNotices, type Notice } from "@/lib/queries";

const ICON: Partial<Record<Notice["kind"], string>> = { like: "♥", comment: "💬", reply: "💬", install: "↓", use: "✓", pick: "✦", author: "✎", report: "⚑" };

// 알림함: 내 글의 검수 결과·좋아요·댓글·받아 감·써봤어요, 내 댓글에 달린 답글, 원작자 확인 요청, 신고 처리 결과.
// 열면 '읽음' 시각을 갱신해 헤더 배지가 사라진다.
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
                <span className="mt-0.5 text-base" aria-hidden>{ICON[n.kind] ?? (n.decision === "approved" ? "✓" : "↩")}</span>
                <div className="min-w-0 flex-1">
                  <p>
                    {n.kind === "install" ? (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> · <b>{n.actor}</b> 님이 받아 갔습니다.</>
                    ) : n.kind === "use" ? (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> · <b>{n.actor}</b> 님이 써봤어요.</>
                    ) : n.kind === "pick" ? (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> · 에디터 픽으로 선정됐습니다.</>
                    ) : n.kind === "author" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 의 원작자로 회원님을 적었습니다. 글에서 맞는지 답해 주세요.</>
                    ) : n.kind === "report" ? (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> 출처 신고를 에디터가 처리했습니다. <span className="text-black/50">({n.actor})</span></>
                    ) : n.kind === "like" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 에 좋아요를 눌렀습니다.</>
                    ) : n.kind === "comment" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 에 댓글을 남겼습니다.</>
                    ) : n.kind === "reply" ? (
                      <><b>{n.actor}</b> 님이 <Link href={n.href} className="font-semibold underline">{n.name}</Link> 의 내 댓글에 답글을 남겼습니다.</>
                    ) : n.decision === "approved" ? (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> · 검수를 통과했습니다. <span className="text-black/50">({n.actor})</span></>
                    ) : (
                      <><Link href={n.href} className="font-semibold underline">{n.name}</Link> 검수가 반려됐습니다. <span className="text-black/50">({n.actor})</span></>
                    )}
                  </p>
                  {(n.kind === "review" || n.kind === "report") && n.note && <p className="mt-1 text-black/60">“{n.note}”</p>}
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

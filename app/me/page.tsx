import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout, updateProfile } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { listBoard, myContribution } from "@/lib/queries";

// 내 정보 = 프로필 + 내 기여 대시보드(공유한 것이 쓰이고 있다는 걸 숫자로)
export default async function MePage() {
  const user = await requireUser();
  const db = getDb();
  const [mine, { rows, total }] = await Promise.all([
    myContribution(db, user.email),
    listBoard(db, { id: user.id, email: user.email, editor: false }, { author: user.email, made: true }),
  ]);
  const me = `/u/${encodeURIComponent(user.email)}`;
  const input = "rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30";
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="glass rounded-3xl p-5 sm:p-8">
        <h1 className="mb-2 text-3xl font-extrabold tracking-[-0.03em]">내 정보</h1>
        <p className="mb-6 text-sm text-black/60">{user.email}</p>
        <form action={updateProfile} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            이름
            <input name="name" defaultValue={user.name} maxLength={50} required autoFocus={!user.name} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            부서
            <input name="department" defaultValue={user.department} maxLength={100} className={input} />
          </label>
          <button className="self-start rounded-xl bg-ink px-5 py-2.5 font-bold text-white">저장</button>
        </form>
        <form action={logout} className="mt-10">
          <button className="text-sm text-black/50 underline">로그아웃</button>
        </form>
      </div>

      <div className="glass rounded-3xl p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap items-baseline gap-3">
          <h2 className="mr-auto text-xl font-extrabold tracking-[-0.02em]">내 기여</h2>
          {mine.waiting > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">검수 대기 {mine.waiting}</span>}
          {total > 0 && <Link href={me} className="text-sm font-medium text-black/60 hover:text-ink">내 원작자 페이지 →</Link>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["공개된 내 글", mine.skills], ["받아 간 사람", mine.installs], ["이번 달", mine.month ? `+${mine.month}` : 0], ["써봤어요", mine.uses], ["받은 좋아요", mine.likes]].map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
              <div className="text-2xl font-extrabold tabular-nums tracking-tight">{n}</div>
              <div className="text-xs text-black/50">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-black/45">
          전사 공개·검수 승인된 글만 셉니다. 받아 간 사람은 사람당 한 번, 본인은 빼고 셉니다.
          {mine.recs > 0 && <> 외부에서 만든 것을 추천한 글 {mine.recs}개는 <Link href={`${me}?show=rec`} className="underline">따로</Link> 봅니다.</>}
        </p>

        {rows.length === 0 ? (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <p className="mr-auto text-sm text-black/60">아직 올린 스킬이 없습니다. 동료가 받아 가고 써 보면 여기에 쌓입니다.</p>
            <Link href="/write" className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">스킬 올리기</Link>
          </div>
        ) : (
          <table className="mt-8 w-full table-fixed text-sm">
            <thead className="text-left text-xs text-black/45">
              <tr><th className="pb-2 font-medium">내 글</th><th className="hidden w-24 pb-2 font-medium sm:table-cell">상태</th><th className="w-20 pb-2 text-right font-medium sm:w-24">받아 간 사람</th><th className="w-16 pb-2 text-right font-medium">좋아요</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-black/5">
                  <td className="truncate py-2.5 pr-3"><Link href={`/skills/${r.slug}`} className="font-semibold hover:underline">{r.name}</Link> <span className="text-xs text-black/40">{r.category_label}</span></td>
                  <td className="hidden whitespace-nowrap py-2.5 pr-3 text-xs sm:table-cell">
                    {r.visibility === "restricted" ? <span className="text-black/50">비공개</span>
                      : !r.approved ? <span className="font-semibold text-amber-700">검수 대기</span>
                      : r.picked ? <span className="font-semibold">✦ 에디터 픽</span>
                      : <span className="text-black/50">공개</span>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{r.installs}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > rows.length && <Link href={me} className="mt-4 inline-block text-sm font-medium text-black/60 hover:text-ink">전체 {total}개 보기 →</Link>}
      </div>
    </div>
  );
}

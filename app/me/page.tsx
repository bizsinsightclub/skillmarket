import { requireUser } from "@/lib/auth";
import { logout, updateProfile } from "@/lib/actions";

export default async function MePage() {
  const user = await requireUser();
  return (
    <div className="glass max-w-md rounded-3xl p-8">
      <h1 className="mb-2 text-3xl font-extrabold tracking-[-0.03em]">내 정보</h1>
      <p className="mb-6 text-sm text-black/60">{user.email}</p>
      <form action={updateProfile} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input name="name" defaultValue={user.name} maxLength={50} required autoFocus={!user.name} className="rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          부서
          <input name="department" defaultValue={user.department} maxLength={100} className="rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30" />
        </label>
        <button className="self-start rounded-xl bg-ink px-5 py-2.5 font-bold text-white">저장</button>
      </form>
      <form action={logout} className="mt-10">
        <button className="text-sm text-black/50 underline">로그아웃</button>
      </form>
    </div>
  );
}

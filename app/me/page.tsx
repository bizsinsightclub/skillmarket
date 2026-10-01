import { requireUser } from "@/lib/auth";
import { logout, updateProfile } from "@/lib/actions";

export default async function MePage() {
  const user = await requireUser();
  return (
    <div className="max-w-md rounded-3xl bg-white p-8 ring-1 ring-black/5">
      <h1 className="mb-2 text-2xl font-bold">내 정보</h1>
      <p className="mb-6 text-sm text-black/60">{user.email}</p>
      <form action={updateProfile} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input name="name" defaultValue={user.name} maxLength={50} required autoFocus={!user.name} className="rounded border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          부서
          <input name="department" defaultValue={user.department} maxLength={100} className="rounded border px-3 py-2" />
        </label>
        <button className="self-start rounded bg-black px-4 py-2 text-white">저장</button>
      </form>
      <form action={logout} className="mt-10">
        <button className="text-sm text-black/50 underline">로그아웃</button>
      </form>
    </div>
  );
}

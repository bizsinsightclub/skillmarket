import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb, one } from "@/lib/db";
import { getSkill } from "@/lib/queries";
import { download, signedUrl } from "@/lib/storage";

// 스냅샷 서빙: 스킬을 볼 수 있는 사람 + DB 에 등록된 경로만
export async function GET(_req: Request, ctx: RouteContext<"/files/[...path]">) {
  const path = (await ctx.params).path.join("/");
  const { viewer } = await requireViewer();
  const db = getDb();
  const snap = await one<{ skill_id: number; kind: string }>(db, "SELECT skill_id, kind FROM app.snapshots WHERE path = $1", [path]);
  if (!snap || !(await getSkill(db, viewer, { id: snap.skill_id }))) notFound();

  if (snap.kind === "image") {
    // 이미지는 Storage 서명 URL 로 넘긴다 (함수 응답 4.5MB 한도·대역폭 회피). 경로가 uuid 라 내용이 바뀌지 않는다.
    return new Response(null, {
      status: 302,
      headers: { Location: await signedUrl(path, 3600), "Cache-Control": "private, max-age=3000" },
    });
  }
  // 데모 HTML 은 직접 응답하면서 격리 헤더를 붙인다: 고유 출처 없음 → 쿠키·부모 창 접근 불가
  return new Response(Buffer.from(await download(path)), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

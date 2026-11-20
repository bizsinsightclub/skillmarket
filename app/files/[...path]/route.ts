import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb, one } from "@/lib/db";
import { getSkill, onlyApproved } from "@/lib/queries";
import { download, signedUrl } from "@/lib/storage";
import { DEMO_CSP } from "@/lib/html-app";

// 스냅샷 서빙: 스킬을 볼 수 있는 사람 + DB 에 등록된 경로만.
// 게시판 본문 이미지(board/…)는 post_images 에 등록된 것만, 로그인한 사람 누구나(게시판은 전사 공개).
export async function GET(_req: Request, ctx: RouteContext<"/files/[...path]">) {
  const path = (await ctx.params).path.join("/");
  const { viewer } = await requireViewer();
  const db = getDb();
  if (path.startsWith("board/")) {
    if (!(await one(db, "SELECT 1 FROM app.post_images WHERE path = $1", [path]))) notFound();
    return toStorage(path);
  }
  const snap = await one<{ skill_id: number; kind: string; pending: boolean }>(db, "SELECT skill_id, kind, pending FROM app.snapshots WHERE path = $1", [path]);
  if (!snap) notFound();
  const skill = await getSkill(db, viewer, { id: snap.skill_id });
  if (!skill) notFound();
  if (snap.kind === "image") return toStorage(path);
  // 재승인 전 데모는 남에게 감춘다(상세 화면과 같은 규칙 — 직접 주소로 열어도 막는다)
  if (snap.pending && onlyApproved(viewer, skill)) notFound();
  // 데모 HTML 은 직접 응답하면서 격리 헤더를 붙인다: 고유 출처 없음 → 쿠키·부모 창 접근 불가
  return new Response(Buffer.from(await download(path)), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": DEMO_CSP, // sandbox + form-action 'none' (폼 바깥 전송 차단)
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

// 이미지는 Storage 서명 URL 로 넘긴다 (함수 응답 4.5MB 한도·대역폭 회피). 경로가 uuid 라 내용이 바뀌지 않는다.
async function toStorage(path: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: await signedUrl(path, 3600), "Cache-Control": "private, max-age=3000" },
  });
}

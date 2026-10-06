import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb, one } from "@/lib/db";
import { getSkill } from "@/lib/queries";
import { download } from "@/lib/storage";
import { APP_SANDBOX, withStorageShim } from "@/lib/html-app";

// HTML 앱 실행: 글을 볼 수 있는 사람만, 격리 헤더를 붙여 직접 응답한다(상세의 iframe·새 창 모두 이 주소).
// ?v=<version_id> 없으면 에디터 픽 승인 버전, 없으면 최신.
export async function GET(req: Request, ctx: RouteContext<"/skills/[slug]/app">) {
  const { slug } = await ctx.params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill || skill.post_type !== "app") notFound();

  const vid = Number(new URL(req.url).searchParams.get("v")) || skill.curated_version_id;
  const version = vid
    ? await one<{ zip_path: string }>(db, "SELECT zip_path FROM app.skill_versions WHERE skill_id = $1 AND id = $2", [skill.id, vid])
    : await one<{ zip_path: string }>(db, "SELECT zip_path FROM app.skill_versions WHERE skill_id = $1 ORDER BY id DESC LIMIT 1", [skill.id]);
  if (!version?.zip_path.endsWith(".html")) notFound();

  const html = new TextDecoder().decode(await download(version.zip_path));
  return new Response(withStorageShim(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // 고유 출처 없음 → 사이트 쿠키·저장소·부모 창에 닿지 못한다. 주소창으로 직접 열어도 같다.
      "Content-Security-Policy": `sandbox ${APP_SANDBOX}`,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
    },
  });
}

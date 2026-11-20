import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSkill, pickVersion, versionParam } from "@/lib/queries";
import { download } from "@/lib/storage";
import { APP_CSP, withStorageShim } from "@/lib/html-app";

// HTML 앱 실행: 글을 볼 수 있는 사람만, 격리 헤더를 붙여 직접 응답한다(상세의 iframe·새 창 모두 이 주소).
// ?v=<version_id> 없으면 승인 버전, 없으면 최신. 남이 여는 검수 필수 글은 승인된 버전만.
export async function GET(req: Request, ctx: RouteContext<"/skills/[slug]/app">) {
  const { slug } = await ctx.params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill || skill.post_type !== "app") notFound();

  const version = await pickVersion(db, viewer, skill, versionParam(req.url));
  if (!version?.zip_path.endsWith(".html")) notFound();

  const html = new TextDecoder().decode(await download(version.zip_path));
  return new Response(withStorageShim(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // 고유 출처 없음 → 사이트 쿠키·저장소·부모 창에 닿지 못한다. 주소창으로 직접 열어도 같다. form-action 'none' 으로 폼 바깥 전송도 막는다.
      "Content-Security-Policy": APP_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
    },
  });
}

import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSkill, pickVersion, versionParam } from "@/lib/queries";
import { download } from "@/lib/storage";
import { APP_CSP } from "@/lib/html-app";

// 스킬 구조도(archify HTML): 글을 볼 수 있는 사람만, HTML 앱과 같은 격리 헤더로 직접 응답한다.
// ?v=<version_id> 없으면 승인 버전, 없으면 최신. 남이 여는 검수 필수 글은 승인된 버전만(pickVersion).
// HTML 은 archify 렌더러가 JSON 명세로 만든 것이지만, 명세는 업로드된 스킬을 읽은 AI 가 썼으므로 신뢰하지 않는다 → sandbox(allow-same-origin 없음).
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();
  const version = await pickVersion(db, viewer, skill, versionParam(req.url));
  if (!version?.diagram_path) notFound();
  const html = new TextDecoder().decode(await download(version.diagram_path));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": APP_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
    },
  });
}

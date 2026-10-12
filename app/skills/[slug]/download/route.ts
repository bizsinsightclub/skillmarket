import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSkill, pickVersion, versionParam } from "@/lib/queries";
import { signedUrl } from "@/lib/storage";

// ?v=<version_id> 없으면 승인 버전(없으면 최신). 남이 받는 검수 필수 글은 승인된 버전만.
// 받을 때마다 기록하고(설치 수는 사람 수로 센다) Storage 서명 URL 로 넘긴다.
export async function GET(req: Request, ctx: RouteContext<"/skills/[slug]/download">) {
  const { slug } = await ctx.params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();

  const version = await pickVersion(db, viewer, skill, versionParam(req.url));
  if (!version?.zip_path) notFound(); // 링크형 글(플러그인·MCP)은 받을 zip 이 없다

  await db.query("INSERT INTO app.installs (skill_id, version_id, user_id) VALUES ($1, $2, $3)", [skill.id, version.id, viewer.id]);
  return new Response(null, {
    status: 302,
    headers: { Location: await signedUrl(version.zip_path, 300, `${skill.slug}-${version.version}.${version.zip_path.split(".").pop()}`), "Cache-Control": "no-store" }, // .zip 또는 렌즈 .md
  });
}

import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb, one } from "@/lib/db";
import { getSkill } from "@/lib/queries";
import { signedUrl } from "@/lib/storage";

// ?v=<version_id> 없으면 최신 버전. 받을 때마다 설치 수 +1 후 Storage 서명 URL 로 넘긴다.
export async function GET(req: Request, ctx: RouteContext<"/skills/[slug]/download">) {
  const { slug } = await ctx.params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();

  const vid = Number(new URL(req.url).searchParams.get("v")) || null;
  const version = vid
    ? await one<{ id: number; version: string; zip_path: string }>(db, "SELECT id, version, zip_path FROM app.skill_versions WHERE skill_id = $1 AND id = $2", [skill.id, vid])
    : await one<{ id: number; version: string; zip_path: string }>(db, "SELECT id, version, zip_path FROM app.skill_versions WHERE skill_id = $1 ORDER BY id DESC LIMIT 1", [skill.id]);
  if (!version?.zip_path) notFound(); // 링크형 글(플러그인·MCP)은 받을 zip 이 없다

  await db.query("INSERT INTO app.installs (skill_id, version_id, user_id) VALUES ($1, $2, $3)", [skill.id, version.id, viewer.id]);
  return new Response(null, {
    status: 302,
    headers: { Location: await signedUrl(version.zip_path, 300, `${skill.slug}-${version.version}.zip`), "Cache-Control": "no-store" },
  });
}

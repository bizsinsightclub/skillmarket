import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";

// 사이트용 미디어(전문가 탭 소개 영상 등)는 공개 저장소에 넣지 않고 Storage 비공개 버킷 site/ 에 둔다.
// 로그인한 사람만, 정해진 파일만 서명 URL 로 넘긴다(영상은 브라우저가 그 주소로 구간 요청).
// 교체: Storage uploads/site/<파일명> 을 같은 이름으로 덮어쓰면 된다.
const FILES = new Set(["the-lens-intro.mp4", "the-lens-intro-poster.jpg"]);

export async function GET(_req: Request, ctx: RouteContext<"/media/[name]">) {
  const { name } = await ctx.params;
  await requireUser();
  if (!FILES.has(name)) notFound();
  return new Response(null, {
    status: 302,
    headers: { Location: await signedUrl(`site/${name}`, 3600), "Cache-Control": "private, max-age=3000" },
  });
}

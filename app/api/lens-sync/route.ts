import { revalidatePath } from "next/cache";
import { getDb, one } from "@/lib/db";
import { safeEqual } from "@/lib/sign";
import { UploadError } from "@/lib/skill-zip";
import { readSyncBody, syncLens } from "@/lib/lens-sync";
import { remove, upload } from "@/lib/storage";

// The Lens(magilite) 의 GitHub Actions 가 렌즈 하나씩 보낸다. 로그인 대신 LENS_SYNC_SECRET 으로만 연다(proxy.ts 에서 제외).
export async function POST(req: Request) {
  const secret = process.env.LENS_SYNC_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("unauthorized", { status: 401 });

  // 자동 등록 글의 올린 사람·원작자 칸 = 첫 번째 에디터(브리핑 자동 등록과 같은 규칙)
  const db = getDb();
  const email = (process.env.EDITOR_EMAILS ?? "").split(",")[0].trim().toLowerCase();
  const owner = await one<{ id: number; name: string; email: string }>(db, "SELECT id, name, email FROM app.users WHERE email = $1", [email]);
  if (!owner) return Response.json({ error: "EDITOR_EMAILS 첫 번째 사용자가 가입돼 있지 않습니다" }, { status: 500 });

  try {
    const input = readSyncBody(await req.json().catch(() => null));
    const result = await syncLens(db, { upload, remove }, owner, input);
    if (result.action !== "unchanged") revalidatePath("/", "layout");
    return Response.json(result);
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

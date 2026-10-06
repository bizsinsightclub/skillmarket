import { revalidatePath } from "next/cache";
import { getDb, one } from "@/lib/db";
import { safeEqual } from "@/lib/sign";
import { fetchBriefings } from "@/lib/briefing-mail";
import { ingestBriefing, parseBriefing } from "@/lib/briefing";

// Vercel Cron 이 하루 한 번 부른다(vercel.json). 로그인 대신 CRON_SECRET 으로만 연다(proxy.ts 에서 제외).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("unauthorized", { status: 401 });

  // 자동 등록 글의 올린 사람·추천인 = 첫 번째 에디터(브리핑 메일함 주인)
  const db = getDb();
  const email = (process.env.EDITOR_EMAILS ?? "").split(",")[0].trim().toLowerCase();
  const owner = await one<{ id: number; name: string; email: string }>(db, "SELECT id, name, email FROM app.users WHERE email = $1", [email]);
  if (!owner) return Response.json({ error: "EDITOR_EMAILS 첫 번째 사용자가 가입돼 있지 않습니다" }, { status: 500 });

  const mails = await fetchBriefings();
  let items = 0;
  const created: string[] = [];
  for (const mail of mails) {
    const parsed = parseBriefing(mail.text);
    items += parsed.length;
    created.push(...(await ingestBriefing(db, parsed, owner, mail.subject)));
  }
  if (created.length) revalidatePath("/", "layout");
  return Response.json({ mails: mails.length, items, created });
}

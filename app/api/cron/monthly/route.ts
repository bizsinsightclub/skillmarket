import { getDb } from "@/lib/db";
import { safeEqual } from "@/lib/sign";
import { sendMail, siteUrl } from "@/lib/mail";
import { digestText, sendDigests } from "@/lib/digest";

export const maxDuration = 300;

// Vercel Cron 이 매달 1~7일 09:00 KST 에 부른다(vercel.json) — 하루 몫씩 나눠 보내고, 다 보냈으면 그냥 끝난다.
// 로그인 대신 CRON_SECRET 으로만 연다(proxy.ts 에서 제외).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("unauthorized", { status: 401 });

  const site = siteUrl();
  const result = await sendDigests(getDb(), async ({ email, rows }, label) => {
    const { subject, text } = digestText(rows, label, site);
    await sendMail(email, subject, text);
  });
  return Response.json(result);
}

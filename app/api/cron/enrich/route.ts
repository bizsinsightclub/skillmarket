import { getDb } from "@/lib/db";
import { safeEqual } from "@/lib/sign";
import { embed } from "@/lib/embeddings";
import { setEmbedding } from "@/lib/queries";
import { classifyTopics } from "@/lib/topics";
import { redescribe } from "@/lib/describe";

// 정기 벡터맵 갱신: 어떤 경로(업로드·아침 브리핑 등)로 들어왔든 아직 임베딩/분야가 빈 글을 채운다.
// Vercel Cron(vercel.json, 매일 02:00 UTC = 11:00 KST, 브리핑 1시간 뒤). proxy.ts 로그인 예외 + CRON_SECRET.
export const maxDuration = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("unauthorized", { status: 401 });
  const db = getDb();

  // 1) 임베딩 NULL 채우기(새 글·브리핑 등). Voyage 무료 티어(3RPM) 배려해 16개씩·사이 20초.
  let embedded = 0;
  const noemb = await db.query<{ id: number; name: string; summary: string; body_md: string }>(
    "SELECT id, name, summary, body_md FROM app.skills WHERE embedding IS NULL ORDER BY id LIMIT 160",
  );
  for (let i = 0; i < noemb.length; i += 16) {
    const chunk = noemb.slice(i, i + 16);
    const vecs = await embed(chunk.map((r) => `${r.name}\n${r.summary ?? ""}\n${r.body_md ?? ""}`.trim().slice(0, 8000)), "document");
    if (!vecs) break; // VOYAGE_API_KEY 없음
    for (let j = 0; j < chunk.length; j++) { await setEmbedding(db, chunk[j].id, vecs[j]); embedded++; }
    if (i + 16 < noemb.length) await sleep(20000);
  }

  // 2) 링크형 분야(topic) NULL 분류(Haiku 배치 30).
  let classified = 0;
  const notopic = await db.query<{ id: number; name: string; summary: string }>(
    "SELECT s.id, s.name, s.summary FROM app.skills s JOIN app.categories c ON c.slug = s.category WHERE c.post_type = 'link' AND s.topic IS NULL ORDER BY s.id LIMIT 90",
  );
  for (let i = 0; i < notopic.length; i += 30) {
    const chunk = notopic.slice(i, i + 30);
    const topics = await classifyTopics(chunk.map((r) => ({ name: r.name, summary: r.summary ?? "" })));
    for (let j = 0; j < chunk.length; j++) { await db.query("UPDATE app.skills SET topic = $2 WHERE id = $1", [chunk[j].id, topics[j]]); classified++; }
    if (i + 30 < notopic.length) await sleep(1500);
  }

  // 3) 링크형 소개(ai_desc) NULL 채우기 — README → Haiku. 하루 25개(브리핑 하루 5~10개라 충분, 함수 300초 한도 안. 남는 건 다음 날). '' 는 근거 없음이라 다시 안 함.
  let described = 0;
  const nodesc = await db.query<{ id: number }>(
    "SELECT s.id FROM app.skills s JOIN app.categories c ON c.slug = s.category WHERE c.post_type = 'link' AND s.ai_desc IS NULL ORDER BY s.id LIMIT 25",
  );
  for (const r of nodesc) { await redescribe(db, r.id); described++; }

  return Response.json({ embedded, classified, described });
}

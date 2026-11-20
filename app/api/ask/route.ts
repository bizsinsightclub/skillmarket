import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { askSkills, type AskMessage } from "@/lib/ask";

// 추천 챗봇. 로그인은 proxy.ts + requireViewer 로 확인. 브라우저가 보내는 messages 는 모양·길이·개수를 검사한다.
export async function POST(req: Request) {
  const { viewer } = await requireViewer();
  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
  const messages: AskMessage[] = raw
    .filter((m): m is { role: string; content: string } => !!m && typeof m === "object" && (("role" in m && (m.role === "user" || m.role === "assistant")) && "content" in m && typeof (m as { content: unknown }).content === "string"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }))
    .slice(-12); // 최근 대화만

  if (!messages.length) return Response.json({ answer: null, picks: [] });
  return Response.json(await askSkills(getDb(), viewer, messages));
}

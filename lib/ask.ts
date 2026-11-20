// "원하는 스킬 찾아주는" 추천 챗봇(하이쿠 기반). 의미 검색으로 후보를 뽑고(가시성 필터 그대로),
// 그 후보 안에서만 Haiku 가 왜 맞는지 설명한다. 링크는 코드가 슬러그로 만들고(모델이 URL·스킬을 지어내지 못하게),
// ANTHROPIC_API_KEY 없으면 설명은 null → 화면은 카드(의미 검색 결과)만 보여준다.
import { embedOne } from "./embeddings.ts";
import { listBoard, type BoardRow, type Viewer } from "./queries.ts";
import type { Db } from "./db.ts";

const MODEL = "claude-haiku-5-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const K = 8; // 후보 수
const KIND_KO: Record<string, string> = { skill: "스킬", link: "플러그인·MCP", lens: "전문가 렌즈", app: "HTML 앱" };

export type AskMessage = { role: "user" | "assistant"; content: string };
export type Pick = { slug: string; name: string; summary: string; category_label: string; post_type: string; author_name: string; maker: string; thumb: string | null };
export type AskResult = { answer: string | null; picks: Pick[] };

function slim(r: BoardRow): Pick {
  return { slug: r.slug, name: r.name, summary: r.summary, category_label: r.category_label, post_type: r.post_type, author_name: r.author_name, maker: r.maker, thumb: r.thumb };
}

export async function askSkills(db: Db, viewer: Viewer, messages: AskMessage[]): Promise<AskResult> {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  if (!question) return { answer: null, picks: [] };

  const emb = await embedOne(question, "query"); // 키 없으면 null → listBoard 가 키워드로 폴백
  const { rows } = await listBoard(db, viewer, { q: question, queryEmbedding: emb, limit: K });
  const picks = rows.map(slim);
  const answer = await explain(messages, picks);
  return { answer, picks };
}

async function explain(messages: AskMessage[], picks: Pick[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const list = picks.length
    ? picks.map((p, i) => `${i + 1}. ${p.name} [${KIND_KO[p.post_type] ?? p.post_type}] — ${p.summary || "(요약 없음)"}`).join("\n")
    : "(검색 결과 없음)";
  const system = `너는 사내 '스킬마켓'의 추천 도우미다. 아래 '후보 목록'에 있는 것만 근거로, 사용자가 하려는 일에 맞는 것을 골라 왜 맞는지 한국어로 짧게 설명한다.
규칙:
- 후보 목록에 없는 스킬을 지어내지 마라. 링크·주소를 쓰지 마라(화면이 카드로 보여준다).
- 맞는 게 있으면 이름으로 2~3개를 추천하고 한 줄 이유를 붙인다.
- 딱 맞는 게 없으면 솔직히 말하고 가장 가까운 것 하나를 제안한다.
- 3~5문장, 불릿은 꼭 필요할 때만.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        thinking: { type: "disabled" }, // 추천은 가벼운 작업 — 생각 끄고 빠르게(Haiku 5.5 는 effort high 이하에서 허용)
        output_config: { effort: "low" },
        system,
        messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: `(후보 목록 — 이 안에서만 추천)\n${list}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
    return text || null;
  } catch {
    return null; // 외부 API 실패 → 카드만 (조용히 폴백)
  }
}

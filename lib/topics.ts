// 플러그인·오픈소스(링크형) 분야 폴더. 종류(plugin/mcp/oss)와 별개로 '무슨 일에 쓰나'로 나눈다.
// 값은 skills.topic 에 저장. Haiku 가 이름+요약으로 분야 1개를 매긴다(키 없으면 'etc').
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-5-5";

export const PLUGIN_TOPICS = [
  { slug: "doc", label: "문서·글쓰기" },
  { slug: "slides", label: "슬라이드·발표" },
  { slug: "data", label: "데이터·분석" },
  { slug: "design", label: "디자인·이미지" },
  { slug: "dev", label: "개발" },
  { slug: "automation", label: "자동화·업무" },
  { slug: "etc", label: "기타" },
] as const;

const SLUGS = new Set<string>(PLUGIN_TOPICS.map((t) => t.slug));
export const topicLabel = (slug: string | null | undefined) => PLUGIN_TOPICS.find((t) => t.slug === slug)?.label ?? "기타";

// 여러 항목을 한 번에 분류. 반환은 입력 순서대로 슬러그(실패·키없음·모르면 'etc').
export async function classifyTopics(items: { name: string; summary: string }[]): Promise<string[]> {
  if (!items.length) return [];
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return items.map(() => "etc");

  const list = items.map((it, i) => `${i}. ${it.name} — ${(it.summary || "").slice(0, 200)}`).join("\n");
  const system = `플러그인·오픈소스 항목을 각각 정확히 한 분야로 분류한다. 분야 슬러그:
- doc: 문서·글쓰기·노트·위키
- slides: 슬라이드·발표·프레젠테이션
- data: 데이터·분석·DB·시각화·스프레드시트
- design: 디자인·이미지·UI·영상·그래픽
- dev: 개발·코딩·CLI·프레임워크·라이브러리·테스트
- automation: 자동화·업무·에이전트·워크플로·크롤링·연동
- etc: 위에 안 맞음
오직 JSON 배열로만 답한다: [{"i":0,"topic":"dev"}, ...] 모든 항목에 대해 한 줄씩.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system,
        messages: [{ role: "user", content: list }],
      }),
    });
    if (!res.ok) return items.map(() => "etc");
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { i: number; topic: string }[];
    const out: string[] = items.map(() => "etc");
    for (const { i, topic } of arr) if (Number.isInteger(i) && i >= 0 && i < out.length && SLUGS.has(topic)) out[i] = topic;
    return out;
  } catch {
    return items.map(() => "etc");
  }
}

export async function classifyTopic(name: string, summary: string): Promise<string> {
  return (await classifyTopics([{ name, summary }]))[0] ?? "etc";
}

// 의미 검색용 임베딩. Anthropic 은 임베딩 API 가 없어 Voyage(Anthropic 공식 추천)를 쓴다.
// VOYAGE_API_KEY 없으면 null 을 돌려 호출부가 기존 키워드(ILIKE) 검색으로 폴백한다 → 키 없이 배포해도 안전.
// ponytail: 코퍼스가 작아(수백 개) 벡터는 real[] 로 저장하고 코사인은 JS 로 전수 계산한다. 수천 개로 커지면 pgvector + hnsw 로.
const MODEL = "voyage-3.5";
const DIM = 1024;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

export const EMBED_DIM = DIM;

// input_type: 저장할 글은 "document", 검색어는 "query" (Voyage 가 비대칭 검색 품질을 올려 준다)
export async function embed(texts: string[], inputType: "query" | "document"): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: texts, input_type: inputType, output_dimension: DIM }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embedOne(text: string, inputType: "query" | "document"): Promise<number[] | null> {
  const t = text.trim().slice(0, 8000); // Voyage 토큰 한도 안. 글 길어도 앞부분이면 충분.
  if (!t) return null;
  return (await embed([t], inputType))?.[0] ?? null;
}

// 두 벡터의 코사인 유사도(-1~1). 길이 다르면 0.
export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

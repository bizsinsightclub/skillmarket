import { one, Params, type Db } from "./db.ts";
import { cosine } from "./embeddings.ts";

// 스킬 조회는 전부 이 파일을 거친다 (CLAUDE.md "공개 범위").
export type Viewer = { id: number; email: string; editor: boolean };

const IS_LINK = "EXISTS (SELECT 1 FROM app.categories lc WHERE lc.slug = s.category AND lc.post_type = 'link')";
// 직접 만든 글 = 링크형이 아니고 만든 곳(외부)이 비어 있음. 아니면 '추천한 글'(외부 플러그인·오픈소스, 웹에서 가져온 공개 스킬 등)
const MADE = `(NOT ${IS_LINK} AND s.maker = '')`;

// viewer 가 볼 수 있는 스킬만 남기는 WHERE 조각. 별칭 s = app.skills.
// 전사 공개는 검수 승인된 것만(링크형은 검수 없이). 올린 사람·원작자·에디터는 승인 전에도, 지정 공개는 허용된 이메일에게.
function visible(v: Viewer, p: Params) {
  if (v.editor) return "true";
  const email = p.add(v.email);
  return `(s.owner_id = ${p.add(v.id)} OR s.author_email = ${email}
           OR (s.visibility = 'public' AND (s.curated_version_id IS NOT NULL OR ${IS_LINK}))
           OR (s.visibility = 'restricted' AND EXISTS (SELECT 1 FROM app.skill_access a WHERE a.skill_id = s.id AND a.email = ${email})))`;
}

// 설치 수 = 받아 간 사람 수(사람당 1회). 올린 사람·원작자 본인은 빼고 센다 — 기여 평가에 쓸 숫자라 다시 받기로 부풀릴 수 없게.
const installers = (since = "") => `(SELECT COUNT(DISTINCT i.user_id)::int FROM app.installs i JOIN app.users iu ON iu.id = i.user_id
  WHERE i.skill_id = s.id AND i.user_id <> s.owner_id AND iu.email <> s.author_email ${since})`;
// 써봤어요 수(본인 제외)
const triers = (since = "") => `(SELECT COUNT(*)::int FROM app.uses u JOIN app.users uu ON uu.id = u.user_id
  WHERE u.skill_id = s.id AND u.user_id <> s.owner_id AND uu.email <> s.author_email ${since})`;

export type Tab = "all" | "pick"; // pick = 에디터 픽(승인된 글 중 에디터가 고른 것)
export type Sort = "latest" | "trending" | "popular" | "picked"; // picked = 최근에 에디터 픽으로 고른 순
export type Kind = "skill" | "link" | "lens" | "app"; // 글 종류 = categories.post_type. link = 플러그인·MCP, lens = The Lens 전문가 렌즈, app = HTML 앱(대시보드·도구)

export type BoardRow = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  category_label: string;
  author_name: string;
  author_email: string;
  maker: string;
  person: string;
  basis: string;
  post_type: Kind;
  visibility: "public" | "restricted";
  picked: boolean; // 에디터 픽
  approved: boolean; // 검수 승인(전사 공개 허용)
  likes: number;
  installs: number;
  trend: number;
  created_at: Date;
  updated_at: Date; // 자동 표지 캐시 키
  thumb: string | null;
};

export const PAGE_SIZE = 20;

const SEM_FLOOR = 0.35; // 이 아래 유사도는 "관련 없음"으로 보고 검색 결과에서 뺀다. 튜닝 가능.

// real[] 컬럼은 드라이버에 따라 number[] 또는 "{0.1,0.2}" 문자열로 올 수 있다.
function toVec(e: unknown): number[] | null {
  if (Array.isArray(e)) return e as number[];
  if (typeof e === "string" && e.startsWith("{")) return e.slice(1, -1).split(",").map(Number);
  return null;
}

export async function listBoard(
  db: Db,
  v: Viewer,
  opts: { tab?: Tab; kind?: Kind; made?: boolean; category?: string; topic?: string; q?: string; sort?: Sort; page?: number; author?: string; limit?: number; queryEmbedding?: number[] | null } = {},
): Promise<{ rows: BoardRow[]; total: number }> {
  const p = new Params();
  const where = [visible(v, p)];

  // 에디터 픽 탭은 비공개 스킬 제외
  if (opts.tab === "pick") where.push("s.picked_at IS NOT NULL AND s.curated_version_id IS NOT NULL AND s.visibility = 'public'");
  if (opts.kind) where.push(`c.post_type = ${p.add(opts.kind)}`);
  if (opts.made !== undefined) where.push(`${opts.made ? "" : "NOT "}${MADE}`); // true = 직접 만든 글, false = 추천한 글
  if (opts.category) where.push(`s.category = ${p.add(opts.category)}`);
  // 플러그인 분야 폴더: etc 는 미분류(NULL)도 포함
  if (opts.topic) where.push(opts.topic === "etc" ? "(s.topic IS NULL OR s.topic = 'etc')" : `s.topic = ${p.add(opts.topic)}`);
  if (opts.author) where.push(`s.author_email = ${p.add(opts.author)}`);

  const q = opts.q?.trim();
  const semantic = !!(q && opts.queryEmbedding && opts.queryEmbedding.length);
  const keyword = () => {
    const like = p.add(`%${q!.replace(/[\\%_]/g, (c) => "\\" + c)}%`);
    where.push(`(s.name ILIKE ${like} OR s.summary ILIKE ${like} OR s.tags ILIKE ${like})`);
  };
  if (q && !semantic) keyword(); // 임베딩 없으면(키 미설정 등) 기존 키워드 검색

  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const limit = Math.min(PAGE_SIZE, Math.max(1, Math.floor(opts.limit ?? PAGE_SIZE)));

  const cols = `s.id, s.slug, s.name, s.summary, c.label AS category_label, s.author_name, s.author_email, s.maker, s.person, s.basis, c.post_type,
            s.visibility, (s.picked_at IS NOT NULL AND s.curated_version_id IS NOT NULL) AS picked, (s.curated_version_id IS NOT NULL) AS approved,
            s.created_at, s.updated_at,
            (SELECT COUNT(*)::int FROM app.likes l WHERE l.skill_id = s.id) AS likes,
            ${installers()} AS installs,
            ${installers("AND i.created_at > now() - interval '7 days'")}
              + 3 * (SELECT COUNT(*)::int FROM app.likes l WHERE l.skill_id = s.id AND l.created_at > now() - interval '7 days') AS trend,
            (SELECT path FROM app.snapshots ss WHERE ss.skill_id = s.id AND ss.kind = 'image' ORDER BY ss.sort_order, ss.id LIMIT 1) AS thumb`;

  // 의미 검색: 후보 전부 가져와 코사인으로 정렬(코퍼스 작아 전수 계산). 결과 없으면 키워드로 폴백.
  if (semantic) {
    const scored = await db.query<BoardRow & { embedding: unknown }>(
      `SELECT ${cols}, s.embedding FROM app.skills s JOIN app.categories c ON c.slug = s.category WHERE ${where.join(" AND ")}`,
      p.values,
    );
    const ranked = scored
      .map((r) => ({ r, score: toVec(r.embedding) ? cosine(opts.queryEmbedding!, toVec(r.embedding)!) : -1 }))
      .filter((x) => x.score >= SEM_FLOOR)
      .sort((a, b) => b.score - a.score);
    if (ranked.length) {
      const rows = ranked.slice((page - 1) * limit, (page - 1) * limit + limit).map(({ r }) => {
        const { embedding, ...rest } = r;
        void embedding;
        return rest as BoardRow;
      });
      return { rows, total: ranked.length };
    }
    if (q) keyword(); // 임베딩이 아직 없거나(백필 전) 관련 결과 없음 → 키워드 폴백
  }

  const order =
    opts.sort === "popular" ? "likes DESC, s.id DESC"
    : opts.sort === "trending" ? "trend DESC, s.id DESC"
    : opts.sort === "picked" ? "s.picked_at DESC NULLS LAST, s.id DESC"
    : "s.id DESC";
  const whereSql = where.join(" AND ");

  const rows = await db.query<BoardRow>(
    `SELECT ${cols}
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     WHERE ${whereSql}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    p.values,
  );
  const total = await one<{ n: number }>(db, `SELECT COUNT(*)::int AS n FROM app.skills s JOIN app.categories c ON c.slug = s.category WHERE ${whereSql}`, p.values);
  return { rows, total: total!.n };
}

// 의미 검색용 임베딩 저장(없으면 null 로 비움). lib/embeddings.ts 가 만든 벡터.
export async function setEmbedding(db: Db, skillId: number, vec: number[] | null) {
  await db.query("UPDATE app.skills SET embedding = $2 WHERE id = $1", [skillId, vec]);
}

export async function listCategories(db: Db, kind?: Kind) {
  const all = await db.query<{ slug: string; label: string; post_type: Kind }>("SELECT slug, label, post_type FROM app.categories ORDER BY sort_order");
  return kind ? all.filter((c) => c.post_type === kind) : all;
}

export type Skill = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  body_md: string;
  category: string;
  category_label: string;
  post_type: Kind;
  tags: string;
  maker: string;
  install_cmd: string;
  homepage_url: string;
  person: string; // 렌즈: 방법론 출처 인물
  basis: string; // 렌즈: 기반 방법론
  bands: string; // 렌즈: 오퍼레이션 단계 (쉼표)
  author_name: string;
  author_email: string;
  author_confirmed: boolean | null; // null = 원작자 확인 대기, false = 원작자가 본인이 아니라고 함
  owner_id: number;
  based_on_skill_id: number | null;
  visibility: "public" | "restricted";
  curation_status: "none" | "pending" | "approved" | "rejected";
  curated_version_id: number | null; // 승인된 버전(전사 공개 글은 이게 있어야 남에게 보인다)
  picked_at: Date | null; // 에디터 픽으로 고른 시각
  created_at: Date;
  updated_at: Date;
};

// 단건 조회도 가시성 필터를 거친다. 못 보면 undefined → 호출부에서 notFound().
// 유사도 지도용: 보이는 링크형 글의 임베딩을 2D(PCA)로 투영 → 점 사이 거리 = 실제 의미 유사도.
// 가까운 점 = 사실상 대체·중복 도구. 분야(색)·인기(좋아요=크기)·점별 최근접 이웃(비슷한 도구) 동봉.
export type MapNode = {
  slug: string; name: string; summary: string; topic: string; x: number; y: number; pop: number; near: { slug: string; sim: number }[];
  kind: string; maker: string; url: string; excerpt: string; desc: string; // 오른쪽 상세 패널용(desc = README 기반 AI 소개)
};
// 마크다운 본문 → 짧은 평문 발췌(지도 상세 패널용). 첫 구분선(---) 뒤(브리핑 자동 등록 안내 등)는 버리고,
// 제목 줄·링크만 있는 줄(공식 페이지 버튼이 대신)·코드블록·이미지·문법 기호를 지운다. drop(=요약)과 겹치는 부분도 뺀다.
export function plainExcerpt(md: string, max = 320, drop = ""): string {
  let t = md.split(/^\s{0,3}(?:[-*_]\s*){3,}$/m)[0]
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, "")
    .replace(/^\s*(?:[-*+]\s+)?\[[^\]]*\]\([^)]*\)\s*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const d = drop.replace(/\s+/g, " ").trim();
  if (d) t = t.replace(d, "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}
export async function pluginMap(db: Db, v: Viewer): Promise<{ nodes: MapNode[] }> {
  const p = new Params();
  const rows = await db.query<{ slug: string; name: string; summary: string; topic: string | null; pop: number; kind: string; maker: string; url: string; body: string; ai_desc: string; embedding: unknown }>(
    `SELECT s.slug, s.name, COALESCE(s.summary, '') AS summary, COALESCE(s.topic, 'etc') AS topic,
            (SELECT COUNT(*)::int FROM app.likes l WHERE l.skill_id = s.id) AS pop,
            c.label AS kind, COALESCE(s.maker, '') AS maker, COALESCE(s.homepage_url, '') AS url, COALESCE(s.body_md, '') AS body, COALESCE(s.ai_desc, '') AS ai_desc, s.embedding
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     WHERE ${visible(v, p)} AND c.post_type = 'link' ORDER BY s.id`,
    p.values,
  );
  const vecs = rows.map((r) => toVec(r.embedding));
  const coords = pca2d(vecs); // rows 정렬 그대로, 임베딩 없는 점은 [0,0]
  const near = rows.map((_, i) => {
    const vi = vecs[i]; if (!vi) return [] as { slug: string; sim: number }[];
    const sims: { slug: string; sim: number }[] = [];
    for (let j = 0; j < rows.length; j++) {
      if (i === j || !vecs[j]) continue;
      const s = cosine(vi, vecs[j]!);
      if (s >= 0.4) sims.push({ slug: rows[j].slug, sim: Math.round(s * 100) / 100 });
    }
    sims.sort((a, b) => b.sim - a.sim);
    return sims.slice(0, 5);
  });
  const nodes = rows.map((r, i): MapNode => ({
    slug: r.slug, name: r.name, summary: r.summary, topic: r.topic ?? "etc",
    x: coords[i][0], y: coords[i][1], pop: r.pop, near: near[i],
    kind: r.kind, maker: r.maker, url: /^https?:\/\//i.test(r.url) ? r.url : "", excerpt: plainExcerpt(r.body, 320, r.summary), desc: r.ai_desc,
  }));
  return { nodes };
}

// n개 d차원 벡터를 2D 로 투영(PCA, 그람행렬 m×m + 거듭제곱법). 두 축 공통 배율이라 점 사이 거리가 보존된다.
export function pca2d(vecs: (number[] | null)[]): [number, number][] {
  const out: [number, number][] = vecs.map(() => [0, 0] as [number, number]);
  const idx = vecs.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return out;
  const d = vecs[idx[0]]!.length;
  const mean = new Array(d).fill(0);
  for (const i of idx) { const v = vecs[i]!; for (let k = 0; k < d; k++) mean[k] += v[k]; }
  for (let k = 0; k < d; k++) mean[k] /= idx.length;
  const X = idx.map((i) => vecs[i]!.map((val, k) => val - mean[k])); // m×d 중심화
  const m = X.length;
  const G: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let a = 0; a < m; a++) for (let b = a; b < m; b++) {
    let s = 0; for (let k = 0; k < d; k++) s += X[a][k] * X[b][k];
    G[a][b] = s; G[b][a] = s;
  }
  const top = (M: number[][]) => { // 거듭제곱법 상위 고유쌍(G 는 PSD → 고유값 ≥0)
    let u = new Array(m).fill(0).map((_, i) => Math.sin(i + 1)); // 결정적 시드
    let lam = 0;
    for (let it = 0; it < 60; it++) {
      const w = new Array(m).fill(0);
      for (let a = 0; a < m; a++) { let s = 0; for (let b = 0; b < m; b++) s += M[a][b] * u[b]; w[a] = s; }
      const norm = Math.hypot(...w) || 1;
      for (let a = 0; a < m; a++) w[a] /= norm;
      u = w; lam = norm;
    }
    return { u, lam };
  };
  const e1 = top(G);
  const G2 = G.map((row, a) => row.map((val, b) => val - e1.lam * e1.u[a] * e1.u[b])); // 디플레이션
  const e2 = top(G2);
  const c1 = e1.u.map((x) => x * Math.sqrt(Math.max(0, e1.lam))); // PCA 점수 = 고유벡터 × √고유값
  const c2 = e2.u.map((x) => x * Math.sqrt(Math.max(0, e2.lam)));
  let maxAbs = 1e-9;
  for (let a = 0; a < m; a++) maxAbs = Math.max(maxAbs, Math.abs(c1[a]), Math.abs(c2[a]));
  const scale = 100 / maxAbs; // 공통 배율 → 거리 왜곡 없음
  idx.forEach((i, a) => { out[i] = [c1[a] * scale, c2[a] * scale]; });
  return out;
}

// 플러그인 분야 폴더 그리드용: 보이는 링크형 글을 분야별로 센다(미분류·etc 는 'etc' 로 합산).
export async function pluginTopicCounts(db: Db, v: Viewer): Promise<Record<string, number>> {
  const p = new Params();
  const rows = await db.query<{ topic: string; n: number }>(
    `SELECT COALESCE(s.topic, 'etc') AS topic, COUNT(*)::int AS n
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     WHERE ${visible(v, p)} AND c.post_type = 'link'
     GROUP BY 1`,
    p.values,
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.topic] = (out[r.topic] ?? 0) + r.n;
  return out;
}

export function getSkill(db: Db, v: Viewer, key: { slug: string } | { id: number }) {
  const p = new Params();
  const cond = "slug" in key ? `s.slug = ${p.add(key.slug)}` : `s.id = ${p.add(key.id)}`;
  return one<Skill>(
    db,
    `SELECT s.*, c.label AS category_label, c.post_type FROM app.skills s JOIN app.categories c ON c.slug = s.category
     WHERE ${cond} AND ${visible(v, p)}`,
    p.values,
  );
}

export function canEdit(v: Viewer, skill: Pick<Skill, "owner_id">) {
  return v.editor || skill.owner_id === v.id;
}

// 검수 필수 글(전사 공개·링크형 아님)을 남이 볼 때는 승인된 버전만 보이고 받을 수 있다.
// 에디터·올린 사람·원작자는 승인 전 버전도.
export function onlyApproved(v: Viewer, s: Pick<Skill, "visibility" | "post_type" | "owner_id" | "author_email">) {
  return s.visibility === "public" && s.post_type !== "link" && !v.editor && s.owner_id !== v.id && s.author_email !== v.email;
}

export type Version = { id: number; version: string; zip_path: string; skill_md: string; changelog: string; created_at: Date; uploader_name: string; uploader_email: string; approved: boolean };

// 승인된 버전 = 지금 승인 버전이거나, 마지막 승인 취소 뒤에 승인된 적 있는 것(검수 필수 전환 때 일괄 승인된 버전은 검수 기록이 없다). 별칭 v·s.
const APPROVED_VERSION = `(v.id = s.curated_version_id OR EXISTS (SELECT 1 FROM app.curation_reviews r WHERE r.version_id = v.id AND r.decision = 'approved'
  AND (s.revoked_at IS NULL OR r.created_at > s.revoked_at)))`;

export function listVersions(db: Db, skillId: number) {
  return db.query<Version>(
    `SELECT v.id, v.version, v.zip_path, v.skill_md, v.changelog, v.created_at, u.name AS uploader_name, u.email AS uploader_email,
            COALESCE(${APPROVED_VERSION}, false) AS approved
     FROM app.skill_versions v JOIN app.users u ON u.id = v.uploaded_by JOIN app.skills s ON s.id = v.skill_id
     WHERE v.skill_id = $1 ORDER BY v.id DESC`,
    [skillId],
  );
}

// 주소의 ?v= 값: 없으면 null, int 범위의 양의 정수가 아니면 NaN(→ 호출부에서 404)
export function versionParam(url: string) {
  const raw = new URL(url).searchParams.get("v");
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 && n <= 2 ** 31 - 1 ? n : NaN;
}

// 받기·실행할 버전. vid 가 없으면 승인 버전, 그것도 없으면 최신. onlyApproved 면 승인된 버전 중에서만.
export async function pickVersion(db: Db, v: Viewer, skill: Skill, vid: number | null) {
  if (Number.isNaN(vid)) return undefined;
  return one<{ id: number; version: string; zip_path: string }>(
    db,
    `SELECT v.id, v.version, v.zip_path FROM app.skill_versions v JOIN app.skills s ON s.id = v.skill_id
     WHERE v.skill_id = $1 AND ($2::int IS NULL OR v.id = $2::int) AND (NOT $3::boolean OR COALESCE(${APPROVED_VERSION}, false))
     ORDER BY COALESCE(v.id = s.curated_version_id, false) DESC, v.id DESC LIMIT 1`,
    [skill.id, vid, onlyApproved(v, skill)],
  );
}

export type Snapshot = { id: number; kind: "image" | "demo"; path: string };

// hideDemoPending = 이 글을 "남"으로 보는 사람(onlyApproved)에게는 재승인 전인 데모를 감춘다.
export function listSnapshots(db: Db, skillId: number, hideDemoPending = false) {
  return db.query<Snapshot>(
    "SELECT id, kind, path FROM app.snapshots WHERE skill_id = $1 AND NOT ($2::boolean AND kind = 'demo' AND pending) ORDER BY sort_order, id",
    [skillId, hideDemoPending],
  );
}

export async function skillStats(db: Db, skillId: number, userId: number) {
  return (await one<{ likes: number; installs: number; uses: number; liked: boolean; used: boolean }>(
    db,
    `SELECT (SELECT COUNT(*)::int FROM app.likes WHERE skill_id = $1) AS likes,
            ${installers()} AS installs, ${triers()} AS uses,
            EXISTS (SELECT 1 FROM app.likes WHERE skill_id = $1 AND user_id = $2) AS liked,
            EXISTS (SELECT 1 FROM app.uses WHERE skill_id = $1 AND user_id = $2) AS used
     FROM app.skills s WHERE s.id = $1`,
    [skillId, userId],
  ))!;
}

// 이 스킬을 원본으로 한 파생 스킬 중 viewer 가 볼 수 있는 것
export function listDerived(db: Db, v: Viewer, skillId: number) {
  const p = new Params();
  return db.query<{ slug: string; name: string; author_name: string }>(
    `SELECT s.slug, s.name, s.author_name FROM app.skills s WHERE s.based_on_skill_id = ${p.add(skillId)} AND ${visible(v, p)} ORDER BY s.id`,
    p.values,
  );
}

export async function listAccess(db: Db, skillId: number) {
  return (await db.query<{ email: string }>("SELECT email FROM app.skill_access WHERE skill_id = $1 ORDER BY email", [skillId])).map((r) => r.email);
}

export function lastReview(db: Db, skillId: number) {
  return one<{ decision: string; note: string; created_at: Date; version: string; editor_name: string }>(
    db,
    `SELECT r.decision, r.note, r.created_at, v.version, u.name AS editor_name
     FROM app.curation_reviews r JOIN app.skill_versions v ON v.id = r.version_id JOIN app.users u ON u.id = r.editor_id
     WHERE r.skill_id = $1 ORDER BY r.id DESC LIMIT 1`,
    [skillId],
  );
}

// 원작자 페이지 합계 (viewer 가 볼 수 있는 스킬만). 외부에서 만든 것(링크형·가져온 스킬)은 추천 → 따로 세고 합계에서 뺀다.
export async function authorStats(db: Db, v: Viewer, email: string) {
  const p = new Params();
  return (await one<{ made: number; recs: number; name: string | null; likes: number; installs: number; uses: number }>(
    db,
    `SELECT COUNT(*) FILTER (WHERE ${MADE})::int AS made, COUNT(*) FILTER (WHERE NOT ${MADE})::int AS recs, MAX(s.author_name) AS name,
            COALESCE(SUM((SELECT COUNT(*) FROM app.likes l WHERE l.skill_id = s.id)) FILTER (WHERE ${MADE}), 0)::int AS likes,
            COALESCE(SUM(${installers()}) FILTER (WHERE ${MADE}), 0)::int AS installs,
            COALESCE(SUM(${triers()}) FILTER (WHERE ${MADE}), 0)::int AS uses
     FROM app.skills s WHERE s.author_email = ${p.add(email)} AND ${visible(v, p)}`,
    p.values,
  ))!;
}

// 검수 대기함: 요청 대기 중인 스킬 (에디터 전용 화면에서만 호출)
// 검수 대기함: 대기함에서 바로 승인할 수 있게 최신 버전(에디터가 보고 있는 그 버전)을 같이 준다
export function listPending(db: Db) {
  return db.query<{
    id: number; slug: string; name: string; summary: string; category_label: string; maker: string; author_name: string; updated_at: Date;
    visibility: string; curated_version_id: number | null; version_id: number; version: string; uploader: string;
    gist: string | null; ai_desc: string | null; post_type: string; homepage_url: string | null;
    scan_score: number | null; scan_rec: string | null; scan_findings: { id: string; category: string; severity: string; file: string; line: number | null }[] | null;
  }>(
    `SELECT s.id, s.slug, s.name, s.summary, c.label AS category_label, s.maker, s.author_name, s.updated_at, s.visibility, s.curated_version_id,
            v.id AS version_id, v.version, COALESCE(NULLIF(u.name, ''), u.email) AS uploader,
            s.gist, NULLIF(s.ai_desc, '') AS ai_desc, c.post_type, s.homepage_url,
            sc.score AS scan_score, sc.recommendation AS scan_rec, sc.findings AS scan_findings
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     JOIN LATERAL (SELECT id, version, uploaded_by FROM app.skill_versions WHERE skill_id = s.id ORDER BY id DESC LIMIT 1) v ON true
     JOIN app.users u ON u.id = v.uploaded_by
     LEFT JOIN app.skill_scans sc ON sc.version_id = v.id
     WHERE s.curation_status = 'pending' ORDER BY s.updated_at`,
  );
}

// 열린 출처 신고 (에디터 전용 화면에서만 호출)
export function listReports(db: Db) {
  return db.query<{ id: number; slug: string; name: string; reason: string; created_at: Date; reporter: string }>(
    `SELECT r.id, s.slug, s.name, r.reason, r.created_at, COALESCE(NULLIF(u.name, ''), u.email) AS reporter
     FROM app.reports r JOIN app.skills s ON s.id = r.skill_id JOIN app.users u ON u.id = r.reporter_id
     WHERE r.resolved_at IS NULL ORDER BY r.id`,
  );
}

export function authorHistory(db: Db, skillId: number) {
  return db.query<{ author_name: string; author_email: string; created_at: Date; changed_by: string }>(
    `SELECT h.author_name, h.author_email, h.created_at, COALESCE(NULLIF(u.name, ''), u.email) AS changed_by
     FROM app.author_history h JOIN app.users u ON u.id = h.changed_by WHERE h.skill_id = $1 ORDER BY h.id`,
    [skillId],
  );
}

// 기여 집계는 전사 공개·승인된 글만(모두에게 같은 숫자가 보이게). 외부에서 만든 것(링크형·가져온 스킬)은 추천이라 뺀다.
// 원작자가 본인이 아니라고 한 글(author_confirmed = false)도 뺀다.
const CREDITED = `s.visibility = 'public' AND s.curated_version_id IS NOT NULL AND ${MADE} AND s.author_confirmed IS NOT FALSE`;

// 내 정보 '내 기여': 내가 원작자인 글, 받아 간 사람(사람당 글마다 1회), 이번 달 새로 받아 간 사람, 써봤어요, 좋아요. 추천한 링크형은 따로.
export async function myContribution(db: Db, email: string) {
  return (await one<{ skills: number; waiting: number; installs: number; month: number; uses: number; likes: number; recs: number }>(
    db,
    `SELECT COUNT(*) FILTER (WHERE ${CREDITED})::int AS skills,
            COUNT(*) FILTER (WHERE s.curation_status = 'pending' AND NOT ${IS_LINK})::int AS waiting,
            COUNT(*) FILTER (WHERE NOT ${MADE})::int AS recs,
            COALESCE(SUM((SELECT COUNT(*) FROM app.likes l WHERE l.skill_id = s.id)) FILTER (WHERE ${CREDITED}), 0)::int AS likes,
            COALESCE(SUM(${installers()}) FILTER (WHERE ${CREDITED}), 0)::int AS installs,
            COALESCE(SUM(${installers("AND i.created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'")}) FILTER (WHERE ${CREDITED}), 0)::int AS month,
            COALESCE(SUM(${triers()}) FILTER (WHERE ${CREDITED}), 0)::int AS uses
     FROM app.skills s WHERE s.author_email = $1`,
    [email],
  ))!;
}

// 명예의 전당: 원작자별 받아 간 사람 + 써봤어요. days 를 주면 그 기간 활동만.
export function hallOfFame(db: Db, opts: { days?: number; limit?: number } = {}) {
  const since = opts.days ? `AND i.created_at > now() - interval '${Math.floor(opts.days)} days'` : "";
  const sinceUse = opts.days ? `AND u.created_at > now() - interval '${Math.floor(opts.days)} days'` : "";
  return db.query<{ author_email: string; author_name: string; skills: number; installs: number; uses: number }>(
    `SELECT * FROM (
       SELECT s.author_email, MAX(s.author_name) AS author_name, COUNT(*)::int AS skills,
              COALESCE(SUM(${installers(since)}), 0)::int AS installs, COALESCE(SUM(${triers(sinceUse)}), 0)::int AS uses
       FROM app.skills s WHERE ${CREDITED} GROUP BY s.author_email
     ) t WHERE installs + uses > 0 ORDER BY installs + uses DESC, skills DESC LIMIT ${Math.max(1, Math.min(100, Math.floor(opts.limit ?? 20)))}`,
  );
}

// 월간 기여 메일용: [start, end) 사이에 받아 가거나 써본 사람이 있는 글(원작자별로 정렬)
export function monthlyActivity(db: Db, start: Date, end: Date) {
  return db.query<{ author_email: string; author_name: string; slug: string; name: string; installs: number; uses: number }>(
    `SELECT * FROM (
       SELECT s.author_email, s.author_name, s.slug, s.name,
              ${installers("AND i.created_at >= $1 AND i.created_at < $2")} AS installs,
              ${triers("AND u.created_at >= $1 AND u.created_at < $2")} AS uses
       FROM app.skills s WHERE ${CREDITED}
     ) t WHERE installs + uses > 0 ORDER BY author_email, installs + uses DESC`,
    [start, end],
  );
}

// 알림함: 내 글에 대한 검수 결과·남의 좋아요·남의 댓글, 내 댓글에 달린 남의 답글. 별도 알림 테이블 없이 기존 기록에서 만든다.
// 내 글의 답글이 내 댓글에 달린 것이면 'reply' 하나로만 센다.
// 받아 감·써봤어요·에디터 픽은 올린 사람과 원작자 모두에게(크레딧은 원작자 몫), 원작자 확인 요청은 원작자에게, 신고 처리 결과는 신고한 사람에게.
export type Notice = {
  kind: "review" | "like" | "comment" | "reply" | "install" | "use" | "pick" | "author" | "report";
  created_at: Date;
  href: string;
  name: string; // 스킬 이름 또는 게시판 글 제목
  decision: string | null;
  note: string | null;
  actor: string;
};

const MINE = "(s.owner_id = $1 OR s.author_email = (SELECT email FROM app.users WHERE id = $1))";
const COMMENT_PLACE =`LEFT JOIN app.skills s ON s.id = c.skill_id LEFT JOIN app.posts p ON p.id = c.post_id`;
const COMMENT_HREF = `COALESCE('/skills/' || s.slug, '/board/' || p.id) || '#c' || c.id`;
const NOTICES = `
  SELECT 'review' AS kind, r.created_at, '/skills/' || s.slug AS href, s.name, r.decision, r.note, u.name AS actor
  FROM app.curation_reviews r JOIN app.skills s ON s.id = r.skill_id JOIN app.users u ON u.id = r.editor_id
  WHERE s.owner_id = $1 AND r.editor_id <> $1
  UNION ALL
  SELECT 'like', l.created_at, '/skills/' || s.slug, s.name, NULL, NULL, COALESCE(NULLIF(u.name, ''), u.email)
  FROM app.likes l JOIN app.skills s ON s.id = l.skill_id JOIN app.users u ON u.id = l.user_id
  WHERE s.owner_id = $1 AND l.user_id <> $1
  UNION ALL
  SELECT 'comment', c.created_at, ${COMMENT_HREF}, COALESCE(s.name, p.title), NULL, NULL, COALESCE(NULLIF(u.name, ''), u.email)
  FROM app.comments c JOIN app.users u ON u.id = c.author_id ${COMMENT_PLACE}
  LEFT JOIN app.comments pc ON pc.id = c.parent_id
  WHERE COALESCE(s.owner_id, p.author_id) = $1 AND c.author_id <> $1 AND NOT c.deleted AND (pc.id IS NULL OR pc.author_id <> $1)
  UNION ALL
  SELECT 'reply', c.created_at, ${COMMENT_HREF}, COALESCE(s.name, p.title), NULL, NULL, COALESCE(NULLIF(u.name, ''), u.email)
  FROM app.comments c JOIN app.users u ON u.id = c.author_id JOIN app.comments pc ON pc.id = c.parent_id ${COMMENT_PLACE}
  WHERE pc.author_id = $1 AND c.author_id <> $1 AND NOT c.deleted
  UNION ALL
  SELECT 'install', MIN(i.created_at), '/skills/' || s.slug, s.name, NULL, NULL, COALESCE(NULLIF(u.name, ''), u.email)
  FROM app.installs i JOIN app.skills s ON s.id = i.skill_id JOIN app.users u ON u.id = i.user_id
  WHERE ${MINE} AND i.user_id <> s.owner_id AND u.email <> s.author_email
  GROUP BY s.id, u.id
  UNION ALL
  SELECT 'use', x.created_at, '/skills/' || s.slug, s.name, NULL, NULL, COALESCE(NULLIF(u.name, ''), u.email)
  FROM app.uses x JOIN app.skills s ON s.id = x.skill_id JOIN app.users u ON u.id = x.user_id
  WHERE ${MINE} AND x.user_id <> s.owner_id AND u.email <> s.author_email
  UNION ALL
  SELECT 'pick', s.picked_at, '/skills/' || s.slug, s.name, NULL, NULL, ''
  FROM app.skills s WHERE ${MINE} AND s.picked_at IS NOT NULL AND s.curated_version_id IS NOT NULL
  UNION ALL
  SELECT 'author', (SELECT MAX(h.created_at) FROM app.author_history h WHERE h.skill_id = s.id), '/skills/' || s.slug, s.name, NULL, NULL,
         COALESCE(NULLIF(o.name, ''), o.email)
  FROM app.skills s JOIN app.users o ON o.id = s.owner_id
  WHERE s.author_email = (SELECT email FROM app.users WHERE id = $1) AND s.author_confirmed IS NULL AND s.owner_id <> $1
  UNION ALL
  SELECT 'report', r.resolved_at, '/skills/' || s.slug, s.name, NULL, r.resolution, COALESCE(NULLIF(u.name, ''), u.email)
  FROM app.reports r JOIN app.skills s ON s.id = r.skill_id JOIN app.users u ON u.id = r.resolved_by
  WHERE r.reporter_id = $1 AND r.resolved_at IS NOT NULL AND r.resolved_by <> $1`;

export function listNotices(db: Db, userId: number, limit = 50) {
  return db.query<Notice>(`SELECT * FROM (${NOTICES}) n ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`, [userId]);
}

export async function unreadNotices(db: Db, userId: number) {
  return (await one<{ n: number }>(
    db,
    `SELECT COUNT(*)::int AS n FROM (${NOTICES}) n, app.users u WHERE u.id = $1 AND n.created_at > u.inbox_seen_at`,
    [userId],
  ))?.n ?? 0;
}

// 헤더 배지: 검수 대기 + 열린 출처 신고
export async function countPending(db: Db) {
  return (await one<{ n: number }>(
    db,
    `SELECT ((SELECT COUNT(*) FROM app.skills WHERE curation_status = 'pending') + (SELECT COUNT(*) FROM app.reports WHERE resolved_at IS NULL))::int AS n`,
  ))!.n;
}

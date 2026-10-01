import { one, Params, type Db } from "./db.ts";

// 스킬 조회는 전부 이 파일을 거친다 (CLAUDE.md "공개 범위").
export type Viewer = { id: number; email: string; editor: boolean };

// viewer 가 볼 수 있는 스킬만 남기는 WHERE 조각. 별칭 s = app.skills.
function visible(v: Viewer, p: Params) {
  if (v.editor) return "true";
  return `(s.visibility = 'public' OR s.owner_id = ${p.add(v.id)}
           OR EXISTS (SELECT 1 FROM app.skill_access a WHERE a.skill_id = s.id AND a.email = ${p.add(v.email)}))`;
}

export type Tab = "all" | "curated" | "pick";
export type Sort = "latest" | "trending" | "popular";

export type BoardRow = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  category_label: string;
  author_name: string;
  author_email: string;
  visibility: "public" | "restricted";
  curated: boolean;
  editor_pick: boolean;
  likes: number;
  installs: number;
  trend: number;
  created_at: Date;
  thumb: string | null;
};

export const PAGE_SIZE = 20;

export async function listBoard(
  db: Db,
  v: Viewer,
  opts: { tab?: Tab; category?: string; q?: string; sort?: Sort; page?: number; author?: string; limit?: number } = {},
): Promise<{ rows: BoardRow[]; total: number }> {
  const p = new Params();
  const where = [visible(v, p)];

  // 큐레이티드·에디터 픽 탭은 비공개 스킬 제외
  if (opts.tab === "curated") where.push("s.curated_version_id IS NOT NULL AND s.visibility = 'public'");
  if (opts.tab === "pick") where.push("s.editor_pick AND s.curated_version_id IS NOT NULL AND s.visibility = 'public'");
  if (opts.category) where.push(`s.category = ${p.add(opts.category)}`);
  if (opts.author) where.push(`s.author_email = ${p.add(opts.author)}`);
  if (opts.q?.trim()) {
    const q = p.add(`%${opts.q.trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`);
    where.push(`(s.name ILIKE ${q} OR s.summary ILIKE ${q} OR s.tags ILIKE ${q})`);
  }

  const order =
    opts.sort === "popular" ? "likes DESC, s.id DESC"
    : opts.sort === "trending" ? "trend DESC, s.id DESC"
    : "s.id DESC";
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const limit = Math.min(PAGE_SIZE, Math.max(1, Math.floor(opts.limit ?? PAGE_SIZE)));
  const whereSql = where.join(" AND ");

  const rows = await db.query<BoardRow>(
    `SELECT s.id, s.slug, s.name, s.summary, c.label AS category_label, s.author_name, s.author_email,
            s.visibility, (s.curated_version_id IS NOT NULL) AS curated, s.editor_pick, s.created_at,
            (SELECT COUNT(*)::int FROM app.likes l WHERE l.skill_id = s.id) AS likes,
            (SELECT COUNT(*)::int FROM app.installs i WHERE i.skill_id = s.id) AS installs,
            (SELECT COUNT(*)::int FROM app.installs i WHERE i.skill_id = s.id AND i.created_at > now() - interval '7 days')
              + 3 * (SELECT COUNT(*)::int FROM app.likes l WHERE l.skill_id = s.id AND l.created_at > now() - interval '7 days') AS trend,
            (SELECT path FROM app.snapshots ss WHERE ss.skill_id = s.id AND ss.kind = 'image' ORDER BY ss.sort_order, ss.id LIMIT 1) AS thumb
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     WHERE ${whereSql}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    p.values,
  );
  const total = await one<{ n: number }>(db, `SELECT COUNT(*)::int AS n FROM app.skills s WHERE ${whereSql}`, p.values);
  return { rows, total: total!.n };
}

export function listCategories(db: Db) {
  return db.query<{ slug: string; label: string }>("SELECT slug, label FROM app.categories ORDER BY sort_order");
}

export type Skill = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  body_md: string;
  category: string;
  category_label: string;
  tags: string;
  author_name: string;
  author_email: string;
  owner_id: number;
  based_on_skill_id: number | null;
  visibility: "public" | "restricted";
  curation_status: "none" | "pending" | "approved" | "rejected";
  curated_version_id: number | null;
  editor_pick: boolean;
  created_at: Date;
  updated_at: Date;
};

// 단건 조회도 가시성 필터를 거친다. 못 보면 undefined → 호출부에서 notFound().
export function getSkill(db: Db, v: Viewer, key: { slug: string } | { id: number }) {
  const p = new Params();
  const cond = "slug" in key ? `s.slug = ${p.add(key.slug)}` : `s.id = ${p.add(key.id)}`;
  return one<Skill>(
    db,
    `SELECT s.*, c.label AS category_label FROM app.skills s JOIN app.categories c ON c.slug = s.category
     WHERE ${cond} AND ${visible(v, p)}`,
    p.values,
  );
}

export function canEdit(v: Viewer, skill: Pick<Skill, "owner_id">) {
  return v.editor || skill.owner_id === v.id;
}

export type Version = { id: number; version: string; zip_path: string; skill_md: string; changelog: string; created_at: Date; uploader_name: string; uploader_email: string };

export function listVersions(db: Db, skillId: number) {
  return db.query<Version>(
    `SELECT v.id, v.version, v.zip_path, v.skill_md, v.changelog, v.created_at, u.name AS uploader_name, u.email AS uploader_email
     FROM app.skill_versions v JOIN app.users u ON u.id = v.uploaded_by WHERE v.skill_id = $1 ORDER BY v.id DESC`,
    [skillId],
  );
}

export type Snapshot = { id: number; kind: "image" | "demo"; path: string };

export function listSnapshots(db: Db, skillId: number) {
  return db.query<Snapshot>("SELECT id, kind, path FROM app.snapshots WHERE skill_id = $1 ORDER BY sort_order, id", [skillId]);
}

export async function skillStats(db: Db, skillId: number, userId: number) {
  return (await one<{ likes: number; installs: number; liked: boolean }>(
    db,
    `SELECT (SELECT COUNT(*)::int FROM app.likes WHERE skill_id = $1) AS likes,
            (SELECT COUNT(*)::int FROM app.installs WHERE skill_id = $1) AS installs,
            EXISTS (SELECT 1 FROM app.likes WHERE skill_id = $1 AND user_id = $2) AS liked`,
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

// 원작자 페이지 합계 (viewer 가 볼 수 있는 스킬만)
export async function authorStats(db: Db, v: Viewer, email: string) {
  const p = new Params();
  return (await one<{ skills: number; name: string | null; likes: number; installs: number }>(
    db,
    `SELECT COUNT(*)::int AS skills, MAX(s.author_name) AS name,
            COALESCE(SUM((SELECT COUNT(*) FROM app.likes l WHERE l.skill_id = s.id)), 0)::int AS likes,
            COALESCE(SUM((SELECT COUNT(*) FROM app.installs i WHERE i.skill_id = s.id)), 0)::int AS installs
     FROM app.skills s WHERE s.author_email = ${p.add(email)} AND ${visible(v, p)}`,
    p.values,
  ))!;
}

// 검수 대기함: 요청 대기 중인 스킬 (에디터 전용 화면에서만 호출)
export function listPending(db: Db) {
  return db.query<{ id: number; slug: string; name: string; author_name: string; updated_at: Date; visibility: string; curated_version_id: number | null }>(
    `SELECT s.id, s.slug, s.name, s.author_name, s.updated_at, s.visibility, s.curated_version_id
     FROM app.skills s WHERE s.curation_status = 'pending' ORDER BY s.updated_at`,
  );
}

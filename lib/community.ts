// 커뮤니티: 댓글·대댓글(한 단계)·공감 + AI Breakthrough 게시판. 권한(로그인·스킬 가시성)은 호출하는 서버 액션·페이지가 확인한다.
import { one, Params, type Db } from "./db.ts";
import { isHttpUrl } from "./link-post.ts";

export class CommunityError extends Error {}

// 댓글이 달리는 곳: 스킬 글(skills) 또는 게시판 글(posts)
export type Target = { skillId: number } | { postId: number };
const where = (t: Target) => ("skillId" in t ? { col: "skill_id", id: t.skillId } : { col: "post_id", id: t.postId });

export const MAX_COMMENT = 2000;
export const MAX_TITLE = 120;
export const MAX_POST = 20000;
export const MAX_BODY_IMAGE = 5 * 1024 * 1024; // 게시판 본문 이미지 한 장

export type Comment = {
  id: number;
  parent_id: number | null;
  author_id: number;
  author: string;
  body: string;
  deleted: boolean;
  created_at: Date;
  reactions: number;
  reacted: boolean;
  replies: Comment[];
};

// 최상위 댓글 + 그 아래 답글. 지운 답글은 감추고, 지운 댓글은 답글이 남아 있을 때만 자리를 남긴다.
export async function listComments(db: Db, target: Target, viewerId: number): Promise<Comment[]> {
  const { col, id } = where(target);
  const rows = await db.query<Comment>(
    `SELECT c.id, c.parent_id, c.author_id, COALESCE(NULLIF(u.name, ''), u.email) AS author, c.body, c.deleted, c.created_at,
            (SELECT COUNT(*)::int FROM app.comment_reactions r WHERE r.comment_id = c.id) AS reactions,
            EXISTS (SELECT 1 FROM app.comment_reactions r WHERE r.comment_id = c.id AND r.user_id = $2) AS reacted
     FROM app.comments c JOIN app.users u ON u.id = c.author_id
     WHERE c.${col} = $1 ORDER BY c.id`,
    [id, viewerId],
  );
  const top = new Map<number, Comment>();
  for (const r of rows) if (r.parent_id === null) top.set(r.id, { ...r, replies: [] });
  for (const r of rows) if (r.parent_id !== null && !r.deleted) top.get(r.parent_id)?.replies.push({ ...r, replies: [] });
  return [...top.values()].filter((c) => !c.deleted || c.replies.length);
}

export const countComments = (list: Comment[]) => list.reduce((n, c) => n + (c.deleted ? 0 : 1) + c.replies.length, 0);

// 답글의 답글은 같은 최상위 댓글 아래로 붙인다(한 단계만)
export async function addComment(db: Db, target: Target, authorId: number, body: string, parentId: number | null) {
  const text = body.trim();
  if (!text) throw new CommunityError("댓글을 입력하세요");
  if (text.length > MAX_COMMENT) throw new CommunityError(`댓글은 ${MAX_COMMENT}자까지입니다`);
  const { col, id } = where(target);
  let parent: number | null = null;
  if (parentId) {
    const p = await one<{ id: number; parent_id: number | null }>(db, `SELECT id, parent_id FROM app.comments WHERE id = $1 AND ${col} = $2`, [parentId, id]);
    if (!p) throw new CommunityError("답글을 달 댓글이 없습니다");
    parent = p.parent_id ?? p.id;
  }
  return (await one<{ id: number }>(db, `INSERT INTO app.comments (${col}, parent_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING id`, [
    id, parent, authorId, text,
  ]))!.id;
}

// 댓글이 달린 곳(권한 확인·화면 갱신용). 지운 댓글이면 undefined
export function commentTarget(db: Db, commentId: number) {
  return one<{ author_id: number; skill_id: number | null; post_id: number | null }>(
    db, "SELECT author_id, skill_id, post_id FROM app.comments WHERE id = $1 AND NOT deleted", [commentId],
  );
}

export async function deleteComment(db: Db, commentId: number, user: { id: number; editor: boolean }) {
  const c = await commentTarget(db, commentId);
  if (!c || (!user.editor && c.author_id !== user.id)) return false;
  await db.query("UPDATE app.comments SET deleted = true, body = '' WHERE id = $1", [commentId]);
  return true;
}

async function toggle(db: Db, table: "comment_reactions" | "post_reactions", col: "comment_id" | "post_id", userId: number, id: number) {
  const removed = await db.query(`DELETE FROM app.${table} WHERE user_id = $1 AND ${col} = $2 RETURNING 1`, [userId, id]);
  if (!removed.length) await db.query(`INSERT INTO app.${table} (user_id, ${col}) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, id]);
}
export const toggleCommentReaction = (db: Db, userId: number, commentId: number) => toggle(db, "comment_reactions", "comment_id", userId, commentId);
export const togglePostReaction = (db: Db, userId: number, postId: number) => toggle(db, "post_reactions", "post_id", userId, postId);

// ── 게시판 ─────────────────────────────────────────────────────────

export type PostInput = { title: string; body_md: string; link_url: string };

export function readPost(raw: PostInput): PostInput {
  const title = raw.title.trim();
  const body_md = raw.body_md.trim();
  const link_url = raw.link_url.trim();
  if (!title) throw new CommunityError("제목을 입력하세요");
  if (title.length > MAX_TITLE) throw new CommunityError(`제목은 ${MAX_TITLE}자까지입니다`);
  if (!body_md && !link_url) throw new CommunityError("본문이나 참고 링크 중 하나는 입력하세요");
  if (body_md.length > MAX_POST) throw new CommunityError(`본문은 ${MAX_POST}자까지입니다`);
  if (link_url && !isHttpUrl(link_url)) throw new CommunityError("참고 링크는 http(s) 주소만 쓸 수 있습니다");
  return { title, body_md, link_url };
}

export const BOARD_PAGE = 20;
export type PostRow = { id: number; title: string; link_url: string; author: string; created_at: Date; comments: number; reactions: number };

export async function listPosts(db: Db, opts: { page?: number; q?: string; limit?: number } = {}) {
  const p = new Params();
  const cond: string[] = [];
  if (opts.q?.trim()) {
    const q = p.add(`%${opts.q.trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`);
    cond.push(`(p.title ILIKE ${q} OR p.body_md ILIKE ${q})`);
  }
  const whereSql = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  const limit = Math.min(BOARD_PAGE, Math.max(1, Math.floor(opts.limit ?? BOARD_PAGE)));
  const page = Math.max(1, Math.floor(opts.page ?? 1)) || 1;
  const rows = await db.query<PostRow>(
    `SELECT p.id, p.title, p.link_url, COALESCE(NULLIF(u.name, ''), u.email) AS author, p.created_at,
            (SELECT COUNT(*)::int FROM app.comments c WHERE c.post_id = p.id AND NOT c.deleted) AS comments,
            (SELECT COUNT(*)::int FROM app.post_reactions r WHERE r.post_id = p.id) AS reactions
     FROM app.posts p JOIN app.users u ON u.id = p.author_id ${whereSql}
     ORDER BY p.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    p.values,
  );
  const total = (await one<{ n: number }>(db, `SELECT COUNT(*)::int AS n FROM app.posts p ${whereSql}`, p.values))!.n;
  return { rows, total };
}

// 글 화면 아래 이동: 이전 글(더 오래된 글)·다음 글(더 새 글), 그리고 지금 글이 들어 있는 목록 쪽 번호
export async function postNeighbors(db: Db, id: number) {
  const r = (await one<{ prev_id: number | null; prev_title: string | null; next_id: number | null; next_title: string | null; newer: number }>(
    db,
    `SELECT pv.id AS prev_id, pv.title AS prev_title, nx.id AS next_id, nx.title AS next_title,
            (SELECT COUNT(*)::int FROM app.posts WHERE id > $1) AS newer
     FROM (SELECT 1) x
     LEFT JOIN LATERAL (SELECT id, title FROM app.posts WHERE id < $1 ORDER BY id DESC LIMIT 1) pv ON true
     LEFT JOIN LATERAL (SELECT id, title FROM app.posts WHERE id > $1 ORDER BY id LIMIT 1) nx ON true`,
    [id],
  ))!;
  return {
    prev: r.prev_id ? { id: r.prev_id, title: r.prev_title! } : null,
    next: r.next_id ? { id: r.next_id, title: r.next_title! } : null,
    page: Math.floor(r.newer / BOARD_PAGE) + 1, // 목록은 최신순
  };
}

export type Post = PostInput & { id: number; author_id: number; author: string; created_at: Date; updated_at: Date; reactions: number; reacted: boolean };

export function getPost(db: Db, id: number, viewerId: number) {
  return one<Post>(
    db,
    `SELECT p.id, p.title, p.body_md, p.link_url, p.author_id, COALESCE(NULLIF(u.name, ''), u.email) AS author, p.created_at, p.updated_at,
            (SELECT COUNT(*)::int FROM app.post_reactions r WHERE r.post_id = p.id) AS reactions,
            EXISTS (SELECT 1 FROM app.post_reactions r WHERE r.post_id = p.id AND r.user_id = $2) AS reacted
     FROM app.posts p JOIN app.users u ON u.id = p.author_id WHERE p.id = $1`,
    [id, viewerId],
  );
}

export async function createPost(db: Db, authorId: number, input: PostInput) {
  const v = readPost(input);
  return (await one<{ id: number }>(db, "INSERT INTO app.posts (author_id, title, body_md, link_url) VALUES ($1, $2, $3, $4) RETURNING id", [
    authorId, v.title, v.body_md, v.link_url,
  ]))!.id;
}

const canManage = (user: { id: number; editor: boolean }, authorId: number) => user.editor || user.id === authorId;

export async function updatePost(db: Db, id: number, user: { id: number; editor: boolean }, input: PostInput) {
  const v = readPost(input);
  const p = await one<{ author_id: number }>(db, "SELECT author_id FROM app.posts WHERE id = $1", [id]);
  if (!p || !canManage(user, p.author_id)) return false;
  await db.query("UPDATE app.posts SET title = $1, body_md = $2, link_url = $3, updated_at = now() WHERE id = $4", [v.title, v.body_md, v.link_url, id]);
  return true;
}

export async function deletePost(db: Db, id: number, user: { id: number; editor: boolean }) {
  const p = await one<{ author_id: number }>(db, "SELECT author_id FROM app.posts WHERE id = $1", [id]);
  if (!p || !canManage(user, p.author_id)) return false;
  await db.query("DELETE FROM app.posts WHERE id = $1", [id]);
  return true;
}

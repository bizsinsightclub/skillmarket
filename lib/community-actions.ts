"use server";

import crypto from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, one } from "./db";
import { requireViewer } from "./auth";
import { getSkill } from "./queries";
import { sniffImage } from "./skill-zip";
import { download, remove, upload } from "./storage";
import {
  CommunityError, MAX_BODY_IMAGE, addComment, commentTarget, createPost, deleteComment, deletePost, toggleCommentReaction, togglePostReaction, updatePost, type Target,
} from "./community";

const num = (form: FormData, key: string) => Number(form.get(key)) || null;

// 댓글이 달린 곳을 찾고, 지금 사용자가 볼 수 있는지(비공개 스킬 포함) 확인한 뒤 갱신할 화면 경로를 돌려준다
async function place(skillId: number | null, postId: number | null) {
  const { user, viewer } = await requireViewer();
  const db = getDb();
  if (skillId) {
    const s = await getSkill(db, viewer, { id: skillId });
    if (s) return { db, user, viewer, target: { skillId } as Target, path: `/skills/${s.slug}` };
  } else if (postId && (await one(db, "SELECT 1 FROM app.posts WHERE id = $1", [postId]))) {
    return { db, user, viewer, target: { postId } as Target, path: `/board/${postId}` };
  }
  notFound();
}

export type FormState = { error?: string };

export async function addCommentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { db, viewer, target, path } = await place(num(form, "skill_id"), num(form, "post_id"));
  try {
    await addComment(db, target, viewer.id, String(form.get("body") ?? "").slice(0, 5000), num(form, "parent_id"));
  } catch (e) {
    if (e instanceof CommunityError) return { error: e.message };
    throw e;
  }
  revalidatePath(path);
  return {};
}

// 지우기·공감은 댓글 id 로 달린 곳을 찾아 같은 가시성 검사를 거친다
async function onComment(form: FormData) {
  const id = num(form, "comment_id");
  const c = id ? await commentTarget(getDb(), id) : undefined;
  if (!id || !c) notFound();
  return { id, ...(await place(c.skill_id, c.post_id)) };
}

export async function deleteCommentAction(form: FormData) {
  const { id, db, viewer, path } = await onComment(form);
  await deleteComment(db, id, viewer);
  revalidatePath(path);
}

export async function toggleCommentReactionAction(form: FormData) {
  const { id, db, viewer, path } = await onComment(form);
  await toggleCommentReaction(db, viewer.id, id);
  revalidatePath(path);
}

export async function togglePostReactionAction(form: FormData) {
  const { db, viewer, target, path } = await place(null, num(form, "post_id"));
  await togglePostReaction(db, viewer.id, (target as { postId: number }).postId);
  revalidatePath(path);
}

// ── 게시판 글 ─────────────────────────────────────────────────────

const postFields = (form: FormData) => ({
  title: String(form.get("title") ?? "").slice(0, 300),
  body_md: String(form.get("body_md") ?? "").slice(0, 30000),
  link_url: String(form.get("link_url") ?? "").slice(0, 1000),
});

export async function createPostAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireViewer();
  let id: number;
  try {
    id = await createPost(getDb(), user.id, postFields(form));
  } catch (e) {
    if (e instanceof CommunityError) return { error: e.message };
    throw e;
  }
  revalidatePath("/board");
  redirect(`/board/${id}`);
}

export async function updatePostAction(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const { viewer } = await requireViewer();
  try {
    if (!(await updatePost(getDb(), id, viewer, postFields(form)))) notFound();
  } catch (e) {
    if (e instanceof CommunityError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/board/${id}`);
  redirect(`/board/${id}`);
}

export async function deletePostAction(id: number) {
  const { viewer } = await requireViewer();
  if (!(await deletePost(getDb(), id, viewer))) notFound();
  revalidatePath("/board");
  redirect("/board");
}

// 게시판 본문 이미지: 브라우저가 tmp 에 올린 파일(uploadOne)을 검사해 board/ 로 옮기고, 본문에 넣을 주소를 돌려준다.
// ponytail: 글을 저장하지 않거나 지워도 이미지는 남는다(고아 파일). 쌓이면 post_images 와 본문을 대조해 정리
export async function attachBoardImage(tmpPath: string): Promise<{ url?: string; error?: string }> {
  const { user } = await requireViewer();
  if (!new RegExp(`^tmp/${user.id}/[0-9a-f-]{36}\\.img$`).test(String(tmpPath))) return { error: "업로드 경로가 올바르지 않습니다" };
  try {
    const data = await download(tmpPath);
    if (data.length > MAX_BODY_IMAGE) return { error: "이미지는 5MB 이하만 넣을 수 있습니다" };
    const ext = sniffImage(data); // 확장자·MIME 이 아니라 실제 바이트로 판별 (SVG 불가)
    if (!ext) return { error: "png·jpg·webp·gif 이미지만 넣을 수 있습니다" };
    const path = `board/${crypto.randomUUID()}.${ext}`;
    await upload(path, data, ext === "jpg" ? "image/jpeg" : `image/${ext}`);
    await getDb().query("INSERT INTO app.post_images (path, uploader_id) VALUES ($1, $2)", [path, user.id]);
    return { url: `/files/${path}` };
  } finally {
    await remove([tmpPath]);
  }
}

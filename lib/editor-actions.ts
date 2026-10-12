"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { requireViewer } from "./auth";
import { CurationError, pick, review, revoke, unpick } from "./curation";
import { CreditError, resolveReport } from "./credit";

async function requireEditor() {
  const { user, viewer } = await requireViewer();
  if (!viewer.editor) notFound();
  return user;
}

function ids(form: FormData) {
  return { skillId: Number(form.get("skill_id")), versionId: Number(form.get("version_id")), slug: String(form.get("slug") ?? "") };
}

function done(slug: string) {
  revalidatePath("/editor");
  revalidatePath(`/skills/${slug}`);
  revalidatePath("/");
}

export async function reviewAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireEditor();
  const { skillId, versionId, slug } = ids(form);
  const decision = form.get("decision") === "approved" ? "approved" : "rejected";
  try {
    await review(getDb(), { skillId, versionId, editorId: user.id, decision, note: String(form.get("note") ?? "").slice(0, 2000) });
  } catch (e) {
    if (e instanceof CurationError) return { error: e.message };
    throw e;
  }
  done(slug);
  return {};
}

// 에디터 픽 고르기·내리기, 승인 취소
export async function pickAction(form: FormData) {
  await requireEditor();
  const { skillId, slug } = ids(form);
  const on = form.get("on") === "1";
  try {
    await (on ? pick(getDb(), skillId) : unpick(getDb(), skillId));
  } catch (e) {
    if (!(e instanceof CurationError)) throw e; // 승인 전 글: 버튼이 안 보이는 경우라 조용히 무시
  }
  done(slug);
}

export async function revokeAction(form: FormData) {
  await requireEditor();
  const { skillId, slug } = ids(form);
  await revoke(getDb(), skillId);
  done(slug);
}

export async function resolveReportAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireEditor();
  try {
    await resolveReport(getDb(), { reportId: Number(form.get("report_id")), editorId: user.id, note: String(form.get("note") ?? "") });
  } catch (e) {
    if (e instanceof CreditError) return { error: e.message };
    throw e;
  }
  revalidatePath("/editor");
  return {};
}

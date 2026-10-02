"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { requireViewer } from "./auth";
import { CurationError, review, unpick } from "./curation";

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

export async function unpickAction(form: FormData) {
  await requireEditor();
  const { skillId, slug } = ids(form);
  await unpick(getDb(), skillId);
  done(slug);
}

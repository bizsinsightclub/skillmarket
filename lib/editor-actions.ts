"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { requireViewer } from "./auth";
import { CurationError, pick, review, revoke, unpick } from "./curation";
import { CreditError, resolveReport } from "./credit";
import { removeSkillFiles } from "./storage";

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

// 검수 대기함에서 바로 처리: "글id:버전id" (브라우저가 마음대로 보낼 수 있어 숫자만 받는다. 버전이 그 글의 것인지는 review 가 다시 확인)
function rows(values: FormDataEntryValue[]) {
  return values.flatMap((v) => {
    const [s, ver] = String(v).split(":").map(Number);
    return Number.isInteger(s) && s > 0 && Number.isInteger(ver) && ver > 0 ? [{ skillId: s, versionId: ver }] : [];
  });
}

async function remove(skillIds: number[]) {
  if (!skillIds.length) return;
  await getDb().query("DELETE FROM app.skills WHERE id = ANY($1::int[])", [skillIds]);
  await Promise.all(skillIds.map(removeSkillFiles));
}

// 한 줄: 승인 · 반려(사유 필수) · 삭제
export async function queueAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireEditor();
  const [row] = rows([form.get("row") ?? ""]);
  const op = form.get("op");
  if (!row) return { error: "잘못된 요청입니다" };
  try {
    if (op === "delete") await remove([row.skillId]);
    else await review(getDb(), { ...row, editorId: user.id, decision: op === "approve" ? "approved" : "rejected", note: String(form.get("note") ?? "").slice(0, 2000) });
  } catch (e) {
    if (e instanceof CurationError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return {};
}

// 고른 것 한꺼번에 승인·삭제 (반려는 사유가 글마다 달라 한 줄씩)
export async function bulkAction(form: FormData) {
  const user = await requireEditor();
  const picked = rows(form.getAll("pick"));
  if (form.get("op") === "delete") await remove(picked.map((r) => r.skillId));
  else {
    for (const r of picked) {
      try {
        await review(getDb(), { ...r, editorId: user.id, decision: "approved", note: "" });
      } catch (e) {
        if (!(e instanceof CurationError)) throw e; // 그사이 지워진 글 등은 건너뛴다
      }
    }
  }
  revalidatePath("/", "layout");
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

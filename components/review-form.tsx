"use client";

import { useActionState } from "react";
import { reviewAction } from "@/lib/editor-actions";

// 에디터가 본 버전(versionId)을 폼에 박아 보낸다 → 검토 중 새 버전이 올라와도 그 버전만 승인
export default function ReviewForm({ skillId, versionId, version, slug }: { skillId: number; versionId: number; version: string; slug: string }) {
  const [state, action, pending] = useActionState(reviewAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="skill_id" value={skillId} />
      <input type="hidden" name="version_id" value={versionId} />
      <input type="hidden" name="slug" value={slug} />
      <textarea name="note" rows={2} placeholder="검수 메모 (반려 시 필수)" className="rounded border px-3 py-2 text-sm" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button name="decision" value="approved" disabled={pending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
          v{version} 승인
        </button>
        <button name="decision" value="rejected" disabled={pending} className="rounded border border-black px-3 py-1.5 text-sm disabled:opacity-50">
          반려
        </button>
      </div>
    </form>
  );
}

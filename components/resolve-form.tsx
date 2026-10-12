"use client";

import { useActionState } from "react";
import { resolveReportAction } from "@/lib/editor-actions";

// 출처 신고 처리: 처리 내용은 신고한 사람의 알림함에 간다
export default function ResolveForm({ reportId }: { reportId: number }) {
  const [state, action, pending] = useActionState(resolveReportAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="report_id" value={reportId} />
      <textarea name="note" rows={2} required maxLength={2000} placeholder="처리 내용 (예: 원작자를 ○○ 님으로 고쳤습니다)" className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="self-start rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">처리 완료</button>
    </form>
  );
}

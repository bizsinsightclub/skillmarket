"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/skill-actions";

// 출처 신고: 남의 것을 자기 것처럼 올렸거나 원작자가 잘못 적혔을 때. 에디터가 검수 대기함에서 처리한다.
export default function ReportForm({ action }: { action: (prev: FormState & { done?: boolean }, form: FormData) => Promise<FormState & { done?: boolean }> }) {
  const [state, submit, pending] = useActionState(action, {});
  if (state.done) return <p className="text-xs text-black/60">신고했습니다. 에디터가 처리하면 알림함으로 알려 드립니다.</p>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-black/45 hover:text-ink">출처·원작자 문제 신고</summary>
      <form action={submit} className="mt-2 flex flex-col gap-2">
        <textarea name="reason" rows={3} maxLength={2000} required placeholder="예: 제가 만든 스킬을 다른 분이 원작자로 올렸습니다 (원본 위치·근거)" className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-black/30" />
        {state.error && <p className="text-red-600">{state.error}</p>}
        <button disabled={pending} className="self-start rounded-full px-3 py-1.5 ring-1 ring-black/20 disabled:opacity-50">{pending ? "보내는 중…" : "에디터에게 신고"}</button>
      </form>
    </details>
  );
}

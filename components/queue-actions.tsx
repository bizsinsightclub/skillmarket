"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { bulkAction, queueAction } from "@/lib/editor-actions";

const btn = "rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50";

// 검수 대기함 한 줄: 승인 · 반려(누르면 사유 칸) · 삭제. row = "글id:버전id" (목록에 보이는 그 버전만 승인)
export function QueueActions({ row, name }: { row: string; name: string }) {
  const [state, action, pending] = useActionState(queueAction, {});
  const [rejecting, setRejecting] = useState(false);
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="row" value={row} />
      {rejecting ? (
        <>
          <input name="note" required autoFocus maxLength={2000} placeholder="반려 사유" aria-label={`${name} 반려 사유`} className="w-44 rounded-lg border border-black/15 px-2 py-1 text-xs outline-none focus:border-black/40" />
          <button name="op" value="reject" disabled={pending} className={`${btn} bg-red-600 text-white`}>반려</button>
          <button type="button" onClick={() => setRejecting(false)} className={`${btn} text-black/50`}>취소</button>
        </>
      ) : (
        <>
          <button name="op" value="approve" disabled={pending} className={`${btn} bg-ink text-white`}>승인</button>
          <button type="button" disabled={pending} onClick={() => setRejecting(true)} className={`${btn} ring-1 ring-black/20`}>반려</button>
          <button
            name="op" value="delete" disabled={pending}
            onClick={(e) => { if (!confirm(`'${name}' 글을 삭제할까요?\n버전·스냅샷·좋아요가 모두 지워지고 되돌릴 수 없습니다.`)) e.preventDefault(); }}
            className={`${btn} text-red-600 ring-1 ring-red-200`}
          >삭제</button>
        </>
      )}
      {state.error && <p className="w-full text-right text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

// 줄마다 있는 체크박스(form="bulk")를 모아 한꺼번에 승인·삭제
export function BulkBar() {
  return (
    <form
      id="bulk" action={bulkAction}
      onSubmit={(e) => {
        const n = new FormData(e.currentTarget).getAll("pick").length;
        const del = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "delete";
        if (!n) { e.preventDefault(); alert("먼저 글을 고르세요"); return; }
        if (!confirm(del ? `고른 ${n}개 글을 삭제할까요? 되돌릴 수 없습니다.` : `고른 ${n}개 글을 지금 버전으로 승인할까요?`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <BulkButtons />
    </form>
  );
}

function BulkButtons() {
  const { pending } = useFormStatus();
  return (
    <>
      <button name="op" value="approve" disabled={pending} className={`${btn} bg-ink text-white`}>{pending ? "처리 중…" : "고른 글 승인"}</button>
      <button name="op" value="delete" disabled={pending} className={`${btn} text-red-600 ring-1 ring-red-200`}>고른 글 삭제</button>
    </>
  );
}

export function SelectAll() {
  return (
    <input
      type="checkbox" aria-label="모두 고르기"
      onChange={(e) => document.querySelectorAll<HTMLInputElement>('input[form="bulk"][name="pick"]').forEach((c) => (c.checked = e.target.checked))}
    />
  );
}

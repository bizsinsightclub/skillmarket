"use client";

import { useActionState } from "react";
import { addCommentAction } from "@/lib/community-actions";
import SubmitButton from "@/components/submit-button";

// 댓글·답글 입력. hidden = 달릴 곳(skill_id 또는 post_id)과 답글이면 parent_id. 올리고 나면 React 가 입력칸을 비운다.
export default function CommentForm({ hidden, placeholder, reply = false }: { hidden: Record<string, number>; placeholder: string; reply?: boolean }) {
  const [state, action] = useActionState(addCommentAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <textarea
        name="body"
        required
        maxLength={2000}
        rows={reply ? 2 : 3}
        placeholder={placeholder}
        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none placeholder:text-black/40 focus:border-black/30"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton busy="올리는 중…" className="self-end rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-black">
        {reply ? "답글 남기기" : "댓글 남기기"}
      </SubmitButton>
    </form>
  );
}

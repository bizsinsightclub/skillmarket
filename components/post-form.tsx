"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/community-actions";
import SubmitButton from "@/components/submit-button";

const input = "rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/30";

// AI Breakthrough 글쓰기·수정 폼
export default function PostForm({ action, values, submit }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  values: { title: string; body_md: string; link_url: string };
  submit: string;
}) {
  const [state, dispatch] = useActionState(action, {});
  return (
    <form action={dispatch} className="panel flex flex-col gap-4 rounded-3xl p-6 sm:p-8">
      <label className="flex flex-col gap-1 text-sm">
        제목 *
        <input name="title" defaultValue={values.title} required maxLength={120} className={`${input} text-base font-semibold`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        참고 링크 <span className="text-xs text-black/45">기사·논문·저장소 주소 (선택)</span>
        <input name="link_url" type="url" defaultValue={values.link_url} placeholder="https://" maxLength={500} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        본문 <span className="text-xs text-black/45">마크다운 · 무엇이 새로운지, 어디에 쓸 수 있을지</span>
        <textarea name="body_md" defaultValue={values.body_md} rows={14} maxLength={20000} className={`${input} font-mono text-sm`} />
      </label>
      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton busy="올리는 중…" className="self-start rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-white hover:bg-amber-600">{submit}</SubmitButton>
    </form>
  );
}

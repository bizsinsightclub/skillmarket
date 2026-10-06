"use client";

import { useActionState, useState, startTransition } from "react";
import type { FormState } from "@/lib/skill-actions";
import { uploadForm } from "@/components/direct-upload";

// 글 종류별 버전 파일: 스킬 zip · 렌즈 .md · HTML 앱 .html
const FILE = {
  skill: { field: "zip", accept: ".zip", label: "스킬 폴더 zip *" },
  lens: { field: "lens", accept: ".md", label: "렌즈 파일 (.md) *" },
  app: { field: "html", accept: ".html,.htm", label: "HTML 파일 *" },
} as const;

export default function VersionForm({ action, suggested, kind }: { action: (p: FormState, f: FormData) => Promise<FormState>; suggested: string; kind: keyof typeof FILE }) {
  const file = FILE[kind];
  const [state, dispatch, pending] = useActionState(action, {});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const error = uploadError ?? state.error;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setUploadError(null);
        setUploading(true);
        const data = await uploadForm(e.currentTarget);
        setUploading(false);
        if (typeof data === "string") return setUploadError(data);
        startTransition(() => dispatch(data));
      }}
      className="flex max-w-xl flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        {file.label}
        <input name={file.field} type="file" accept={file.accept} required className="rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        버전 *
        <input name="version" defaultValue={suggested} required maxLength={20} className="w-40 rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        변경 내용
        <textarea name="changelog" rows={4} className="rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30" />
      </label>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={uploading || pending} className="self-start rounded-xl bg-ink px-6 py-2.5 font-bold text-white disabled:opacity-50">
        {uploading ? "파일 올리는 중…" : pending ? "확인하는 중…" : "새 버전 등록"}
      </button>
    </form>
  );
}

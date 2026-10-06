"use client";

import { useActionState, useRef, useState } from "react";
import { attachBoardImage, type FormState } from "@/lib/community-actions";
import { uploadOne } from "@/components/direct-upload";
import SubmitButton from "@/components/submit-button";

const input = "rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/30";
const MAX_IMAGE = 5 * 1024 * 1024; // 서버(attachBoardImage)도 같은 한도로 다시 검사
const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

// AI Breakthrough 글쓰기·수정 폼. 본문 이미지는 버튼·붙여넣기·끌어다 놓기로 넣고, 커서 자리에 ![](주소) 를 끼운다.
export default function PostForm({ action, values, submit }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  values: { title: string; body_md: string; link_url: string };
  submit: string;
}) {
  const [state, dispatch] = useActionState(action, {});
  const body = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(0); // 올리는 중인 이미지 수
  const [imageError, setImageError] = useState<string | null>(null);

  async function addImages(files: File[]) {
    setImageError(null);
    for (const file of files) {
      if (!IMAGE_TYPES.split(",").includes(file.type)) { setImageError("png·jpg·webp·gif 이미지만 넣을 수 있습니다"); continue; }
      if (file.size > MAX_IMAGE) { setImageError(`${file.name}: 이미지는 5MB 이하만 넣을 수 있습니다`); continue; }
      setBusy((n) => n + 1);
      try {
        const res = await attachBoardImage(await uploadOne("images", file));
        if (!res.url) throw new Error(res.error);
        const ta = body.current!;
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
        ta.setRangeText(`\n![${alt}](${res.url})\n`, ta.selectionStart, ta.selectionEnd, "end");
        ta.focus();
      } catch (e) {
        setImageError(`${file.name}: ${e instanceof Error && e.message ? e.message : "이미지를 올리지 못했습니다"}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

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
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="body_md">
            본문 <span className="text-xs text-black/45">마크다운 · 이미지는 붙여넣기·끌어다 놓기도 됩니다(장당 5MB)</span>
          </label>
          <label className="shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-black/15 hover:ring-black/40">
            {busy ? "이미지 올리는 중…" : "이미지 넣기"}
            <input
              type="file"
              accept={IMAGE_TYPES}
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                addImages(files);
              }}
            />
          </label>
        </div>
        <textarea
          id="body_md"
          ref={body}
          name="body_md"
          defaultValue={values.body_md}
          rows={14}
          maxLength={20000}
          className={`${input} font-mono text-sm`}
          onPaste={(e) => {
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
            if (files.length) { e.preventDefault(); addImages(files); }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
            if (files.length) { e.preventDefault(); addImages(files); }
          }}
        />
        {imageError && <p className="text-sm text-red-600">{imageError}</p>}
      </div>
      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton busy="올리는 중…" className="self-start rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-white hover:bg-amber-600">{submit}</SubmitButton>
    </form>
  );
}

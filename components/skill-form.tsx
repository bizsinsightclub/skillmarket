"use client";

import { useActionState, useState, startTransition } from "react";
import type { FormState } from "@/lib/skill-actions";
import { uploadForm } from "./direct-upload";

type Snapshot = { id: number; kind: "image" | "demo"; path: string };

export type SkillFormValues = {
  name: string;
  summary: string;
  body_md: string;
  category: string;
  tags: string;
  author_name: string;
  author_email: string;
  based_on: string;
  visibility: "public" | "restricted";
  access: string;
};

const input = "rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30";
const label = "flex flex-col gap-1 text-sm";
const hint = "text-xs text-black/50";

export default function SkillForm({
  mode,
  action,
  categories,
  values,
  snapshots = [],
}: {
  mode: "create" | "edit";
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  categories: { slug: string; label: string }[];
  values: SkillFormValues;
  snapshots?: Snapshot[];
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [visibility, setVisibility] = useState(values.visibility);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const error = uploadError ?? state.error;
  const busy = uploading || pending;

  return (
    // form action 대신 onSubmit: 파일은 Storage 로 먼저 올리고, 검증 실패 시 입력값(파일 포함)이 초기화되지 않게
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
      className="flex max-w-3xl flex-col gap-5"
    >
      {mode === "create" && (
        <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
          <legend className="rounded-full bg-ink px-3 py-0.5 text-xs font-bold text-white">스킬 파일</legend>
          <label className={label}>
            스킬 폴더 zip *
            <input name="zip" type="file" accept=".zip" required className={input} />
            <span className={hint}>SKILL.md 가 들어 있는 폴더를 zip 으로 묶어 올리세요. 최대 20MB.</span>
          </label>
          <label className={label}>
            버전
            <input name="version" defaultValue="1.0.0" maxLength={20} className={`${input} w-40`} />
          </label>
        </fieldset>
      )}

      <label className={label}>
        이름{mode === "edit" && " *"}
        <input name="name" defaultValue={values.name} maxLength={80} required={mode === "edit"} className={input} />
        {mode === "create" && <span className={hint}>비우면 SKILL.md 의 name 을 씁니다.</span>}
      </label>
      <label className={label}>
        한 줄 요약
        <input name="summary" defaultValue={values.summary} maxLength={200} className={input} />
        {mode === "create" && <span className={hint}>비우면 SKILL.md 의 description 을 씁니다.</span>}
      </label>
      <div className="flex gap-4">
        <label className={label}>
          분류
          <select name="category" defaultValue={values.category} className={input}>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </label>
        <label className={`${label} flex-1`}>
          태그
          <input name="tags" defaultValue={values.tags} placeholder="쉼표로 구분, 최대 10개" className={input} />
        </label>
      </div>
      <label className={label}>
        설명 (마크다운)
        <textarea name="body_md" defaultValue={values.body_md} rows={10} className={`${input} font-mono text-sm`} placeholder="언제 쓰는지, 어떻게 쓰는지, 주의할 점" />
      </label>

      <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
        <legend className="rounded-full bg-ink px-3 py-0.5 text-xs font-bold text-white">원작자 크레딧</legend>
        <div className="flex gap-4">
          <label className={`${label} flex-1`}>
            원작자 이름 *
            <input name="author_name" defaultValue={values.author_name} maxLength={50} required className={input} />
          </label>
          <label className={`${label} flex-1`}>
            원작자 이메일 *
            <input name="author_email" type="email" defaultValue={values.author_email} required className={input} />
          </label>
        </div>
        <label className={label}>
          원본 스킬 (다른 스킬을 고쳐 만든 경우)
          <input name="based_on" defaultValue={values.based_on} placeholder="원본 스킬 주소 또는 slug" className={input} />
        </label>
      </fieldset>

      <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
        <legend className="rounded-full bg-ink px-3 py-0.5 text-xs font-bold text-white">스냅샷</legend>
        {snapshots.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {snapshots.map((s) => (
              <label key={s.id} className="flex flex-col items-center gap-1 text-xs">
                {s.kind === "image" ? (
                  <img src={`/files/${s.path}`} alt="" className="h-20 w-32 rounded border object-cover" />
                ) : (
                  <span className="flex h-20 w-32 items-center justify-center rounded border bg-black/5">데모 HTML</span>
                )}
                <span><input type="checkbox" name="remove_snapshot" value={s.id} /> 삭제</span>
              </label>
            ))}
          </div>
        )}
        <label className={label}>
          결과물 이미지 추가
          <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className={input} />
          <span className={hint}>png·jpg·webp·gif, 장당 5MB, 최대 10장. 첫 장이 목록 썸네일이 됩니다.</span>
        </label>
        <label className={label}>
          데모 HTML {snapshots.some((s) => s.kind === "demo") && "(올리면 기존 데모를 바꿉니다)"}
          <input name="demo" type="file" accept=".html,.htm" className={input} />
          <span className={hint}>스킬로 만든 결과물 HTML. 격리된 화면에서 보여줍니다. 최대 4MB.</span>
        </label>
      </fieldset>

      <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
        <legend className="rounded-full bg-ink px-3 py-0.5 text-xs font-bold text-white">공개 범위</legend>
        <div className="flex gap-6 text-sm">
          <label><input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} /> 전사 공개</label>
          <label><input type="radio" name="visibility" value="restricted" checked={visibility === "restricted"} onChange={() => setVisibility("restricted")} /> 지정한 사람만</label>
        </div>
        {visibility === "restricted" && (
          <label className={label}>
            볼 수 있는 사람 이메일
            <textarea name="access" defaultValue={values.access} rows={3} className={`${input} text-sm`} placeholder="a@samsung.com, b@cheil.com (쉼표·줄바꿈 구분)" />
            <span className={hint}>나와 에디터는 항상 볼 수 있습니다. 아직 가입하지 않은 사람도 지정할 수 있습니다.</span>
          </label>
        )}
      </fieldset>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="self-start rounded-xl bg-ink px-6 py-2.5 font-bold text-white disabled:opacity-50">
        {uploading ? "파일 올리는 중…" : pending ? "확인하는 중…" : mode === "create" ? "등록" : "저장"}
      </button>
    </form>
  );
}

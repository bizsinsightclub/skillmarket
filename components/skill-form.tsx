"use client";

import { useActionState, useState, startTransition } from "react";
import type { FormState } from "@/lib/skill-actions";
import { uploadForm } from "./direct-upload";

type Snapshot = { id: number; kind: "image" | "demo"; path: string };
type PostType = "skill" | "link" | "lens";
type Category = { slug: string; label: string; post_type: PostType };

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
  maker: string;
  install_cmd: string;
  homepage_url: string;
  person: string;
  basis: string;
};

const input = "rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30";
const label = "flex flex-col gap-1 text-sm";
const hint = "text-xs text-black/50";
const legend = "rounded-full bg-ink px-3 py-0.5 text-xs font-bold text-white";

export default function SkillForm({
  mode,
  action,
  categories,
  values,
  snapshots = [],
}: {
  mode: "create" | "edit";
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  categories: Category[];
  values: SkillFormValues;
  snapshots?: Snapshot[];
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [visibility, setVisibility] = useState(values.visibility);
  const [category, setCategory] = useState(values.category);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const error = uploadError ?? state.error;
  const busy = uploading || pending;

  // 분류가 글 종류를 정한다: 스킬(zip) / 플러그인·MCP(링크) / 전문가 렌즈(.md)
  const typeOf = (slug: string): PostType => categories.find((c) => c.slug === slug)?.post_type ?? "skill";
  const type = typeOf(category);
  const isLink = type === "link";
  const isLens = type === "lens";
  // 수정할 때는 글 종류를 못 바꾼다 → 같은 종류 분류만 보여 준다
  const options = mode === "edit" ? categories.filter((c) => c.post_type === typeOf(values.category)) : categories;
  const creditWho = isLink ? "추천인" : "원작자";
  const TYPE_LABEL: Record<PostType, string> = { skill: "스킬", link: "", lens: "" };

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
      {isLens && <span hidden data-tone="lens" /> /* 전문가 렌즈를 고르면 헤더도 퍼플 */}
      <label className={label}>
        무엇을 올리나요?
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${input} w-60`}>
          {options.map((c) => <option key={c.slug} value={c.slug}>{TYPE_LABEL[c.post_type] ? `${TYPE_LABEL[c.post_type]} · ${c.label}` : c.label}</option>)}
        </select>
        <span className={hint}>
          {isLink
            ? "추천하는 플러그인·MCP 를 설치 방법과 함께 소개합니다. 파일은 올리지 않습니다."
            : isLens
              ? "The Lens 의 렌즈(.md) 파일을 올립니다. 실존 인물의 공개된 방법론을 기준으로 삼되, 인물을 흉내 내는 렌즈는 올리지 마세요."
              : "SKILL.md 가 든 스킬 폴더를 올립니다."}
        </span>
      </label>

      {isLens && (
        <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
          <legend className={legend}>렌즈</legend>
          {mode === "create" && (
            <>
              <label className={label}>
                렌즈 파일 (.md) *
                <input name="lens" type="file" accept=".md" required className={input} />
                <span className={hint}>시스템 프롬프트 코드블록과 # 역할 · # 오퍼레이션 · # 출력 형식 절이 있어야 합니다. 최대 200KB.</span>
              </label>
              <label className={label}>
                버전
                <input name="version" defaultValue="1.0.0" maxLength={20} className={`${input} w-40`} />
              </label>
            </>
          )}
          <div className="flex gap-4">
            <label className={`${label} w-48`}>
              기반 인물 *
              <input name="person" defaultValue={values.person} maxLength={40} required placeholder="예: 김난도" className={input} />
            </label>
            <label className={`${label} flex-1`}>
              기반 방법론 *
              <input name="basis" defaultValue={values.basis} maxLength={80} required placeholder="예: 김난도의 소비트렌드 분석 방법론" className={input} />
            </label>
          </div>
          <span className={hint}>인물 이름은 방법론의 출처 표기입니다. 화면에는 &lsquo;○○ 기반&rsquo;으로 나옵니다.</span>
        </fieldset>
      )}

      {mode === "create" && type === "skill" && (
        <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
          <legend className={legend}>스킬 파일</legend>
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

      {isLink && (
        <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
          <legend className={legend}>설치 정보</legend>
          <label className={label}>
            만든 곳 *
            <input name="maker" defaultValue={values.maker} maxLength={80} required placeholder="예: Anthropic, Vercel, 개인 개발자 이름" className={input} />
          </label>
          <label className={label}>
            설치 명령
            <textarea name="install_cmd" defaultValue={values.install_cmd} rows={3} className={`${input} font-mono text-sm`} placeholder={"/plugin marketplace add owner/repo\n/plugin install name@marketplace"} />
          </label>
          <label className={label}>
            공식 페이지
            <input name="homepage_url" type="url" defaultValue={values.homepage_url} placeholder="https://github.com/…" className={input} />
            <span className={hint}>설치 명령과 공식 페이지 중 하나는 꼭 넣어 주세요.</span>
          </label>
        </fieldset>
      )}

      <label className={label}>
        이름{(mode === "edit" || isLink) && " *"}
        <input name="name" defaultValue={values.name} maxLength={80} required={mode === "edit" || isLink} className={input} />
        {mode === "create" && type === "skill" && <span className={hint}>비우면 SKILL.md 의 name 을 씁니다.</span>}
        {mode === "create" && isLens && <span className={hint}>비우면 렌즈 파일 제목에서 가져옵니다.</span>}
      </label>
      <label className={label}>
        한 줄 요약
        <input name="summary" defaultValue={values.summary} maxLength={200} className={input} />
        {mode === "create" && type === "skill" && <span className={hint}>비우면 SKILL.md 의 description 을 씁니다.</span>}
      </label>
      <label className={label}>
        태그
        <input name="tags" defaultValue={values.tags} placeholder="쉼표로 구분, 최대 10개" className={input} />
      </label>
      <label className={label}>
        설명 (마크다운)
        <textarea name="body_md" defaultValue={values.body_md} rows={10} className={`${input} font-mono text-sm`} placeholder="언제 쓰는지, 어떻게 쓰는지, 주의할 점" />
      </label>

      <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
        <legend className={legend}>{isLink ? "추천인" : "원작자 크레딧"}</legend>
        <div className="flex gap-4">
          <label className={`${label} flex-1`}>
            {creditWho} 이름 *
            <input name="author_name" defaultValue={values.author_name} maxLength={50} required className={input} />
          </label>
          <label className={`${label} flex-1`}>
            {creditWho} 이메일 *
            <input name="author_email" type="email" defaultValue={values.author_email} required className={input} />
          </label>
        </div>
        {!isLink && (
          <label className={label}>
            {isLens ? "원본 렌즈 (다른 렌즈를 고쳐 만든 경우)" : "원본 스킬 (다른 스킬을 고쳐 만든 경우)"}
            <input name="based_on" defaultValue={values.based_on} placeholder="원본 스킬 주소 또는 slug" className={input} />
          </label>
        )}
      </fieldset>

      <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
        <legend className={legend}>스냅샷</legend>
        {snapshots.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {snapshots.map((s) => (
              <label key={s.id} className="flex flex-col items-center gap-1 text-xs">
                {s.kind === "image" ? (
                  <img src={`/files/${s.path}`} alt="" className="h-20 w-32 rounded-lg border object-cover" />
                ) : (
                  <span className="flex h-20 w-32 items-center justify-center rounded-lg border bg-black/5">데모 HTML</span>
                )}
                <span><input type="checkbox" name="remove_snapshot" value={s.id} /> 삭제</span>
              </label>
            ))}
          </div>
        )}
        <label className={label}>
          {type === "skill" ? "결과물 이미지 추가" : "소개 이미지 추가"}
          <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className={input} />
          <span className={hint}>png·jpg·webp·gif, 장당 5MB, 최대 10장. 첫 장이 목록 썸네일이 됩니다.</span>
        </label>
        {type === "skill" && (
          <label className={label}>
            데모 HTML {snapshots.some((s) => s.kind === "demo") && "(올리면 기존 데모를 바꿉니다)"}
            <input name="demo" type="file" accept=".html,.htm" className={input} />
            <span className={hint}>스킬로 만든 결과물 HTML. 격리된 화면에서 보여줍니다. 최대 4MB.</span>
          </label>
        )}
      </fieldset>

      <fieldset className="panel flex flex-col gap-3 rounded-2xl p-5">
        <legend className={legend}>공개 범위</legend>
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

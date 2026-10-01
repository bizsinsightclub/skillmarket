import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, one } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { installDirName } from "@/lib/skill-zip";
import { deleteSkill, requestCuration, toggleLike } from "@/lib/skill-actions";
import { pickAction, uncurateAction } from "@/lib/editor-actions";
import {
  canEdit, getSkill, lastReview, listAccess, listDerived, listSnapshots, listVersions, skillStats,
} from "@/lib/queries";
import Markdown from "@/components/markdown";
import ReviewForm from "@/components/review-form";

const STATUS: Record<string, string> = { pending: "검수 대기 중", approved: "검수 완료", rejected: "반려됨" };

export default async function SkillPage({ params }: PageProps<"/skills/[slug]">) {
  const { slug } = await params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();

  const editable = canEdit(viewer, skill);
  const [versions, snapshots, stats, basedOn, derived, review, access, owner] = await Promise.all([
    listVersions(db, skill.id),
    listSnapshots(db, skill.id),
    skillStats(db, skill.id, viewer.id),
    skill.based_on_skill_id ? getSkill(db, viewer, { id: skill.based_on_skill_id }) : undefined,
    listDerived(db, viewer, skill.id),
    editable ? lastReview(db, skill.id) : undefined,
    editable && skill.visibility === "restricted" ? listAccess(db, skill.id) : [],
    one<{ name: string; email: string }>(db, "SELECT name, email FROM app.users WHERE id = $1", [skill.owner_id]),
  ]);
  const latest = versions[0];
  const curated = versions.find((v) => v.id === skill.curated_version_id);
  const contributors = [...new Map(versions.map((v) => [v.uploader_email, v.uploader_name || v.uploader_email])).values()];
  const dir = installDirName(latest.skill_md, skill.slug);
  const zipName = `${skill.slug}-${latest.version}.zip`;
  const tags = skill.tags ? skill.tags.split(",") : [];
  const images = snapshots.filter((s) => s.kind === "image");
  const demo = snapshots.find((s) => s.kind === "demo");
  const ids = { skill_id: skill.id, slug: skill.slug };

  return (
    <article className="flex flex-col gap-8">
      <header className="border-b-2 border-black pb-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-black/50">
          <Link href={`/?category=${skill.category}`} className="hover:underline">{skill.category_label}</Link>
          {skill.editor_pick ? <span className="rounded bg-black px-1.5 text-xs text-white">에디터 픽</span> : null}
          {curated && <span className="rounded border border-black px-1.5 text-xs text-black">검수 완료 v{curated.version}</span>}
          {skill.visibility === "restricted" && <span className="rounded bg-black/10 px-1.5 text-xs text-black">비공개</span>}
        </div>
        <h1 className="text-2xl font-bold">{skill.name}</h1>
        {skill.summary && <p className="mt-1 text-black/70">{skill.summary}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-black/60">
          <span>원작자 <Link href={`/u/${encodeURIComponent(skill.author_email)}`} className="font-medium text-black hover:underline">{skill.author_name}</Link></span>
          {owner && owner.email !== skill.author_email && <span>올린 사람 {owner.name || owner.email}</span>}
          <span>등록 {fmtDate(skill.created_at)}</span>
          <span>수정 {fmtDate(skill.updated_at)}</span>
          <span>설치 {stats.installs}</span>
        </div>
        {basedOn && (
          <p className="mt-2 text-sm">
            원작: <Link href={`/skills/${basedOn.slug}`} className="underline">{basedOn.name}</Link> by {basedOn.author_name}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.map((t) => <Link key={t} href={`/?q=${encodeURIComponent(t)}`} className="rounded bg-black/5 px-2 py-0.5 text-xs">#{t}</Link>)}
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleLike.bind(null, skill.slug)}>
          <button className={`rounded border px-4 py-2 text-sm ${stats.liked ? "border-black bg-black text-white" : "border-black/30"}`}>
            {stats.liked ? "♥" : "♡"} 좋아요 {stats.likes}
          </button>
        </form>
        <a href={`/skills/${skill.slug}/download`} className="rounded bg-black px-4 py-2 text-sm text-white">최신 v{latest.version} 받기</a>
        {curated && curated.id !== latest.id && (
          <a href={`/skills/${skill.slug}/download?v=${curated.id}`} className="rounded border border-black px-4 py-2 text-sm">검수 버전 v{curated.version} 받기</a>
        )}
        {editable && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link href={`/skills/${skill.slug}/edit`} className="rounded border px-3 py-2">수정</Link>
            <Link href={`/skills/${skill.slug}/versions/new`} className="rounded border px-3 py-2">새 버전</Link>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded border px-3 py-2 text-red-600">삭제</summary>
              <form action={deleteSkill.bind(null, skill.slug)} className="absolute right-0 z-10 mt-1 w-56 rounded border bg-white p-3 shadow">
                <p className="mb-2 text-xs">버전·스냅샷·좋아요가 모두 지워집니다.</p>
                <button className="w-full rounded bg-red-600 px-3 py-1.5 text-white">정말 삭제</button>
              </form>
            </details>
          </div>
        )}
      </div>

      {editable && (
        <section className="rounded border border-black/15 p-4 text-sm">
          <h2 className="mb-2 font-bold">큐레이션</h2>
          <p>
            상태: {STATUS[skill.curation_status] ?? "요청 안 함"}
            {curated && ` · 큐레이티드에 v${curated.version} 게시 중`}
          </p>
          {review?.decision === "rejected" && skill.curation_status === "rejected" && (
            <p className="mt-1 text-red-700">반려 사유 (v{review.version}, {review.editor_name}): {review.note}</p>
          )}
          {skill.curation_status !== "pending" && latest.id !== skill.curated_version_id && (
            <form action={requestCuration.bind(null, skill.slug)} className="mt-2">
              <button className="rounded border border-black px-3 py-1.5">v{latest.version} 검수 요청</button>
            </form>
          )}
          {viewer.editor && (
            <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4">
              <p className="font-bold">에디터</p>
              <ReviewForm skillId={skill.id} versionId={latest.id} version={latest.version} slug={skill.slug} />
              <div className="flex gap-2">
                <form action={pickAction}>
                  <input type="hidden" name="skill_id" value={ids.skill_id} />
                  <input type="hidden" name="slug" value={ids.slug} />
                  <input type="hidden" name="version_id" value={skill.curated_version_id ?? latest.id} />
                  <input type="hidden" name="on" value={skill.editor_pick ? "0" : "1"} />
                  <button className="rounded border px-3 py-1.5">{skill.editor_pick ? "에디터 픽 해제" : `에디터 픽 지정${curated ? "" : ` (v${latest.version} 승인 포함)`}`}</button>
                </form>
                {curated && (
                  <form action={uncurateAction}>
                    <input type="hidden" name="skill_id" value={ids.skill_id} />
                    <input type="hidden" name="slug" value={ids.slug} />
                    <button className="rounded border px-3 py-1.5">큐레이티드에서 내리기</button>
                  </form>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {access.length > 0 && (
        <section className="text-sm">
          <h2 className="mb-1 font-bold">볼 수 있는 사람</h2>
          <p className="text-black/70">{access.join(", ")}</p>
        </section>
      )}

      {(images.length > 0 || demo) && (
        <section>
          <h2 className="mb-3 text-lg font-bold">결과물 미리보기</h2>
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {images.map((s) => (
                <a key={s.id} href={`/files/${s.path}`} target="_blank">
                  <img src={`/files/${s.path}`} alt="" className="aspect-video w-full rounded border object-cover" />
                </a>
              ))}
            </div>
          )}
          {demo && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm text-black/60">
                <span>데모</span>
                <a href={`/files/${demo.path}`} target="_blank" className="underline">새 창으로 보기</a>
              </div>
              {/* allow-same-origin 절대 금지 (CLAUDE.md 보안 규칙) */}
              <iframe src={`/files/${demo.path}`} sandbox="allow-scripts" className="h-[600px] w-full rounded border" title="데모" />
            </div>
          )}
        </section>
      )}

      {skill.body_md && (
        <section>
          <h2 className="mb-3 text-lg font-bold">설명</h2>
          <Markdown>{skill.body_md}</Markdown>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">설치</h2>
        <p className="mb-2 text-sm text-black/60">zip 을 받은 폴더에서 실행하세요.</p>
        <p className="mb-1 text-xs text-black/50">macOS · Linux · Git Bash</p>
        <pre className="mb-3 select-all overflow-x-auto rounded bg-black/[.04] p-3 text-sm">{`mkdir -p ~/.claude/skills/${dir} && unzip -o ${zipName} -d ~/.claude/skills/${dir}`}</pre>
        <p className="mb-1 text-xs text-black/50">Windows PowerShell</p>
        <pre className="select-all overflow-x-auto rounded bg-black/[.04] p-3 text-sm">{`Expand-Archive ${zipName} -DestinationPath $HOME\\.claude\\skills\\${dir} -Force`}</pre>
      </section>

      <details>
        <summary className="cursor-pointer text-lg font-bold">SKILL.md 원문 (v{latest.version})</summary>
        <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap rounded bg-black/[.04] p-4 text-sm">{latest.skill_md}</pre>
      </details>

      <section>
        <h2 className="mb-3 text-lg font-bold">버전 이력</h2>
        <table className="w-full text-sm">
          <thead className="border-y border-black/20 text-black/60">
            <tr><th className="py-2 text-left font-normal">버전</th><th className="text-left font-normal">변경 내용</th><th className="font-normal">올린 사람</th><th className="font-normal">날짜</th><th /></tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-b border-black/10">
                <td className="py-2">v{v.version} {v.id === skill.curated_version_id && <span className="ml-1 rounded border border-black px-1 text-xs">검수</span>}</td>
                <td className="text-black/70">{v.changelog}</td>
                <td className="text-center">{v.uploader_name || v.uploader_email}</td>
                <td className="text-center text-black/50">{fmtDate(v.created_at)}</td>
                <td className="text-right"><a href={`/skills/${skill.slug}/download?v=${v.id}`} className="underline">받기</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-black/60">기여자: {contributors.join(", ")}</p>
      </section>

      {derived.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">파생 스킬 {derived.length}개</h2>
          <ul className="list-disc pl-5 text-sm">
            {derived.map((d) => <li key={d.slug}><Link href={`/skills/${d.slug}`} className="underline">{d.name}</Link> by {d.author_name}</li>)}
          </ul>
        </section>
      )}

      <div className="border-t border-black/10 pt-4">
        <Link href="/" className="text-sm underline">목록으로</Link>
      </div>
    </article>
  );
}

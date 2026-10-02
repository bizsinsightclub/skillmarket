import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, one } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { installDirName } from "@/lib/skill-zip";
import { parseLensFile } from "@/lib/lens-file";
import { deleteSkill, requestCuration, toggleLike } from "@/lib/skill-actions";
import { unpickAction } from "@/lib/editor-actions";
import {
  canEdit, getSkill, lastReview, listAccess, listDerived, listSnapshots, listVersions, skillStats,
} from "@/lib/queries";
import Markdown from "@/components/markdown";
import ReviewForm from "@/components/review-form";
import CopyButton from "@/components/copy-button";
import { Cover } from "@/components/skill-card";

const STATUS: Record<string, string> = { pending: "검수 대기 중", approved: "에디터 픽 선정", rejected: "반려됨" };

// 렌즈 .md 의 시스템 프롬프트(첫 코드블록). 예전 파일이 형식에 안 맞아도 화면은 그려야 하니 원문으로 대체
function lensPromptOf(md: string) {
  try {
    return parseLensFile(md).prompt;
  } catch {
    return md;
  }
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-3xl p-6 sm:p-8">
      <h2 className="mb-4 text-lg font-extrabold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

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
  const unixCmd = `mkdir -p ~/.claude/skills/${dir} && unzip -o ${zipName} -d ~/.claude/skills/${dir}`;
  const winCmd = `Expand-Archive ${zipName} -DestinationPath $HOME\\.claude\\skills\\${dir} -Force`;
  const tags = skill.tags ? skill.tags.split(",") : [];
  const images = snapshots.filter((s) => s.kind === "image");
  const demo = snapshots.find((s) => s.kind === "demo");
  const ids = { skill_id: skill.id, slug: skill.slug };
  // 링크형 글(플러그인·MCP): zip·버전 대신 설치 명령·공식 페이지. 버전 표기는 숨긴다
  const isLink = skill.post_type === "link";
  const isLens = skill.post_type === "lens";
  const lensPrompt = isLens ? lensPromptOf(latest.skill_md) : "";
  const bands = skill.bands ? skill.bands.split(",") : [];
  const vl = (v: string) => (isLink ? "" : `v${v}`);
  const [listHref, listLabel] = isLink ? ["/plugins", "플러그인·MCP"] : isLens ? ["/experts", "전문가"] : ["/skills", "스킬"];

  return (
    <div>
      {isLens && <span hidden data-tone="lens" />}
      <nav className="mb-5 flex gap-2 text-sm text-black/45">
        <Link href={listHref} className="hover:text-ink">{listLabel}</Link>/
        {skill.category_label !== listLabel && <><Link href={`${listHref}?category=${skill.category}`} className="hover:text-ink">{skill.category_label}</Link>/</>}
        <span className="text-black/70">{skill.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* 왼쪽: 결과물 미리보기 */}
        <div className="flex min-w-0 flex-col gap-5">
          {images.map((s) => (
            <a key={s.id} href={`/files/${s.path}`} target="_blank" className="glass block overflow-hidden rounded-3xl p-2">
              <img src={`/files/${s.path}`} alt={`${skill.name} 결과물`} className="w-full rounded-2xl" />
            </a>
          ))}
          {demo && (
            <div className="glass overflow-hidden rounded-3xl p-2">
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-semibold">라이브 데모</span>
                <a href={`/files/${demo.path}`} target="_blank" className="text-black/50 hover:text-ink">새 창으로 ↗</a>
              </div>
              {/* allow-same-origin 절대 금지 (CLAUDE.md 보안 규칙) */}
              <iframe src={`/files/${demo.path}`} sandbox="allow-scripts" className="h-[620px] w-full rounded-2xl bg-white" title="데모" />
            </div>
          )}
          {!images.length && !demo && (
            <div className="aspect-[16/10] overflow-hidden rounded-3xl">
              <Cover slug={skill.slug} name={skill.name} category={skill.category_label} />
            </div>
          )}
        </div>

        {/* 오른쪽: 정보 패널 */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass rounded-3xl p-7">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {curated && <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">✦ 에디터 픽 {vl(curated.version)}</span>}
              {skill.visibility === "restricted" && <span className="rounded-full bg-ink px-3 py-1 text-xs text-white">비공개</span>}
            </div>
            <div className="flex items-start gap-3">
              <h1 className="mr-auto text-3xl font-extrabold leading-tight tracking-[-0.03em]">
                {skill.name} {!isLink && <span className="align-middle text-sm font-normal text-black/40">v{latest.version}</span>}
              </h1>
              <form action={toggleLike.bind(null, skill.slug)}>
                <button title="좋아요" className={`grid h-11 w-11 place-items-center rounded-full text-lg ring-1 transition ${stats.liked ? "bg-ink text-accent ring-ink" : "ring-black/15 hover:ring-black/40"}`}>
                  {stats.liked ? "♥" : "♡"}
                </button>
              </form>
            </div>
            {skill.summary && <p className="mt-3 text-black/65">{skill.summary}</p>}
            {isLens && (
              <div className="mt-4 rounded-2xl bg-lens-bg p-4 text-sm text-lens-ink ring-1 ring-lens-2/40">
                <p className="flex items-center gap-2 font-semibold text-lens-deep"><span className="h-2 w-2 rounded-full bg-lens" />{skill.basis} 기반</p>
                {bands.length > 0 && (
                  <ol className="mt-3 flex flex-wrap gap-1.5">
                    {bands.map((b, i) => (
                      <li key={b} className="rounded-full bg-lens px-2.5 py-1 text-xs font-medium text-white">{i + 1}. {b}</li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 text-xs text-lens-ink/55">공개된 방법론을 분석 기준으로 삼은 렌즈입니다. 인물을 흉내 내거나 그 사람의 견해를 대변하지 않습니다.</p>
              </div>
            )}

            <div className="mt-5 flex items-center gap-4 text-sm text-black/60">
              <span>♥ {stats.likes}</span>
              {!isLink && <span>↓ {stats.installs}</span>}
              <span>업데이트 {fmtDate(skill.updated_at)}</span>
            </div>

            {isLink ? (
              <div className="mt-6 grid grid-cols-2 gap-2">
                {skill.install_cmd && <CopyButton text={skill.install_cmd} label="설치 명령 복사" className="rounded-2xl bg-ink px-4 py-3.5 text-sm font-bold text-white hover:bg-black" />}
                {skill.homepage_url && (
                  <a href={skill.homepage_url} target="_blank" rel="noopener noreferrer" className={`rounded-2xl bg-white/80 px-4 py-3.5 text-center text-sm font-bold ring-1 ring-black/10 hover:bg-white ${skill.install_cmd ? "" : "col-span-2"}`}>
                    공식 페이지 ↗
                  </a>
                )}
              </div>
            ) : isLens ? (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <a href={`/skills/${skill.slug}/download`} className="rounded-2xl bg-lens px-4 py-3.5 text-center text-sm font-bold text-white hover:bg-lens-deep">렌즈 파일 받기</a>
                <CopyButton text={lensPrompt} label="프롬프트 복사" className="rounded-2xl bg-white/80 px-4 py-3.5 text-sm font-bold ring-1 ring-black/10 hover:bg-white" />
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <CopyButton text={unixCmd} label="설치 명령 복사" className="rounded-2xl bg-ink px-4 py-3.5 text-sm font-bold text-white hover:bg-black" />
                <a href={`/skills/${skill.slug}/download`} className="rounded-2xl bg-white/80 px-4 py-3.5 text-center text-sm font-bold ring-1 ring-black/10 hover:bg-white">
                  ZIP 받기
                </a>
              </div>
            )}
            {curated && curated.id !== latest.id && (
              <a href={`/skills/${skill.slug}/download?v=${curated.id}`} className="mt-2 block text-center text-xs text-black/55 underline">
                에디터 픽 버전 v{curated.version} 받기
              </a>
            )}

            <dl className="mt-6 space-y-2.5 border-t border-black/5 pt-5 text-sm">
              {isLens && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-black/45">기반 인물</dt>
                  <dd className="font-semibold">{skill.person}</dd>
                </div>
              )}
              {isLink && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-black/45">만든 곳</dt>
                  <dd className="font-semibold">{skill.maker}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-black/45">{isLink ? "추천인" : "원작자"}</dt>
                <dd><Link href={`/u/${encodeURIComponent(skill.author_email)}`} className="font-semibold hover:underline">{skill.author_name}</Link></dd>
              </div>
              {basedOn && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-black/45">원작</dt>
                  <dd><Link href={`/skills/${basedOn.slug}`} className="underline">{basedOn.name}</Link> by {basedOn.author_name}</dd>
                </div>
              )}
              {owner && owner.email !== skill.author_email && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-black/45">올린 사람</dt>
                  <dd>{owner.name || owner.email}</dd>
                </div>
              )}
              {!isLink && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-black/45">기여자</dt>
                  <dd>{contributors.join(", ")}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-black/45">등록</dt>
                <dd>{fmtDate(skill.created_at)}</dd>
              </div>
            </dl>

            {tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Link key={t} href={`/skills?q=${encodeURIComponent(t)}`} className="rounded-full px-3 py-1 text-xs ring-1 ring-black/10 hover:ring-black/30">#{t}</Link>
                ))}
              </div>
            )}

            {editable && (
              <div className="mt-6 flex gap-2 border-t border-black/5 pt-5 text-sm">
                <Link href={`/skills/${skill.slug}/edit`} className="rounded-full px-4 py-2 ring-1 ring-black/15 hover:ring-black/40">수정</Link>
                {!isLink && <Link href={`/skills/${skill.slug}/versions/new`} className="rounded-full px-4 py-2 ring-1 ring-black/15 hover:ring-black/40">새 버전</Link>}
                <details className="relative ml-auto">
                  <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-red-600 ring-1 ring-red-200">삭제</summary>
                  <form action={deleteSkill.bind(null, skill.slug)} className="glass absolute right-0 z-10 mt-2 w-60 rounded-2xl p-4">
                    <p className="mb-3 text-xs text-black/60">버전·스냅샷·좋아요가 모두 지워집니다.</p>
                    <button className="w-full rounded-full bg-red-600 px-3 py-2 text-white">정말 삭제</button>
                  </form>
                </details>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 아래: 상세 정보 */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-w-0 flex-col gap-6">
          {skill.body_md && (
            <Block title="설명">
              <Markdown>{skill.body_md}</Markdown>
            </Block>
          )}

          {isLink ? (
            <Block title="설치 방법">
              {skill.install_cmd ? (
                <>
                  <p className="mb-3 text-sm text-black/60">Claude Code 에서 차례로 입력하세요.</p>
                  <div className="flex items-start gap-2">
                    <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded-xl bg-paper p-3 text-sm">{skill.install_cmd}</pre>
                    <CopyButton text={skill.install_cmd} label="복사" className="shrink-0 rounded-xl px-3 py-3 text-xs ring-1 ring-black/10" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-black/60">공식 페이지의 안내를 따르세요.</p>
              )}
              {skill.homepage_url && (
                <a href={skill.homepage_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm underline">{skill.homepage_url}</a>
              )}
            </Block>
          ) : isLens ? (
            <>
              <Block title="The Lens 에서 쓰기">
                <p className="text-sm leading-relaxed text-black/70">
                  The Lens 에 바로 설치하는 기능은 준비 중입니다. 지금은 <b>렌즈 파일(.md)</b>을 받아 The Lens 관리자에게 전달하거나,
                  프롬프트를 복사해 다른 Claude 대화의 시스템 프롬프트로 써 보세요.
                </p>
              </Block>
              <Block title={`렌즈 원문 (v${latest.version})`}>
                <details>
                  <summary className="cursor-pointer text-sm text-black/60">원문 펼치기</summary>
                  <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm">{latest.skill_md}</pre>
                </details>
              </Block>
            </>
          ) : (
            <>
          <Block title="설치 방법">
              <p className="mb-3 text-sm text-black/60">ZIP 을 받은 폴더에서 실행하세요.</p>
              <p className="mb-1 text-xs text-black/45">macOS · Linux · Git Bash</p>
              <div className="mb-4 flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-paper p-3 text-sm">{unixCmd}</pre>
                <CopyButton text={unixCmd} label="복사" className="shrink-0 rounded-xl px-3 py-3 text-xs ring-1 ring-black/10" />
              </div>
              <p className="mb-1 text-xs text-black/45">Windows PowerShell</p>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-paper p-3 text-sm">{winCmd}</pre>
                <CopyButton text={winCmd} label="복사" className="shrink-0 rounded-xl px-3 py-3 text-xs ring-1 ring-black/10" />
              </div>
            </Block>

            <Block title={`SKILL.md (v${latest.version})`}>
              <details>
                <summary className="cursor-pointer text-sm text-black/60">원문 펼치기</summary>
                <pre className="mt-3 max-h-[600px] overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm">{latest.skill_md}</pre>
              </details>
            </Block>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {editable && (
            <Block title="큐레이션">
              <p className="text-sm">
                {STATUS[skill.curation_status] ?? "검수 요청 안 함"}
                {curated && <span className="text-black/50"> · 에디터 픽 {vl(curated.version)} 게시 중</span>}
              </p>
              {review?.decision === "rejected" && skill.curation_status === "rejected" && (
                <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">반려 사유 ({vl(review.version) || "등록본"}, {review.editor_name}): {review.note}</p>
              )}
              {skill.curation_status !== "pending" && latest.id !== skill.curated_version_id && (
                <form action={requestCuration.bind(null, skill.slug)} className="mt-3">
                  <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">{vl(latest.version)} 검수 요청</button>
                </form>
              )}
              {viewer.editor && (
                <div className="mt-5 flex flex-col gap-3 border-t border-black/5 pt-5 text-sm">
                  <p className="font-semibold">에디터</p>
                  <ReviewForm skillId={skill.id} versionId={latest.id} version={isLink ? "" : latest.version} slug={skill.slug} />
                  <div className="flex flex-wrap gap-2">
                    {curated && (
                      <form action={unpickAction}>
                        <input type="hidden" name="skill_id" value={ids.skill_id} />
                        <input type="hidden" name="slug" value={ids.slug} />
                        <button className="rounded-full px-3 py-1.5 ring-1 ring-black/15">에디터 픽에서 내리기</button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </Block>
          )}

          {access.length > 0 && (
            <Block title="볼 수 있는 사람">
              <p className="text-sm text-black/70">{access.join(", ")}</p>
            </Block>
          )}

          {!isLink && (
          <Block title="버전 이력">
            <ul className="divide-y divide-black/5 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      v{v.version} {v.id === skill.curated_version_id && <span className="ml-1 rounded-full bg-accent px-2 text-xs">에디터 픽</span>}
                    </p>
                    {v.changelog && <p className="text-black/60">{v.changelog}</p>}
                    <p className="text-xs text-black/40">{v.uploader_name || v.uploader_email} · {fmtDate(v.created_at)}</p>
                  </div>
                  <a href={`/skills/${skill.slug}/download?v=${v.id}`} className="shrink-0 text-xs underline">받기</a>
                </li>
              ))}
            </ul>
          </Block>
          )}

          {derived.length > 0 && (
            <Block title={`파생 스킬 ${derived.length}개`}>
              <ul className="space-y-1.5 text-sm">
                {derived.map((d) => (
                  <li key={d.slug}><Link href={`/skills/${d.slug}`} className="font-semibold hover:underline">{d.name}</Link> <span className="text-black/50">by {d.author_name}</span></li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      </div>
    </div>
  );
}

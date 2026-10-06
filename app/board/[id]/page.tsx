import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { getPost } from "@/lib/community";
import { deletePostAction, togglePostReactionAction } from "@/lib/community-actions";
import Markdown from "@/components/markdown";
import Comments from "@/components/comments";
import SubmitButton from "@/components/submit-button";

export default async function PostPage({ params }: PageProps<"/board/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const { viewer } = await requireViewer();
  const post = await getPost(getDb(), id, viewer.id);
  if (!post) notFound();
  const mine = viewer.editor || viewer.id === post.author_id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <span hidden data-tab="/board" />
      <article className="panel rounded-3xl p-6 sm:p-10">
        <Link href="/board" className="text-sm text-black/45 hover:text-ink">AI Breakthrough</Link>
        <h1 className="mt-2 break-words text-3xl font-extrabold tracking-[-0.03em]">{post.title}</h1>
        <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-black/50">
          <span className="font-semibold text-black/70">{post.author}</span>
          <span>{fmtDate(post.created_at, true)}</span>
          {post.updated_at.getTime() - post.created_at.getTime() > 60_000 && <span>수정됨</span>}
        </p>

        {post.link_url && (
          <a href={post.link_url} target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200 hover:bg-amber-100">
            <span className="font-bold text-amber-800">참고 링크 ↗</span>
            <span className="min-w-0 truncate text-black/60">{post.link_url}</span>
          </a>
        )}

        {post.body_md && <div className="mt-6"><Markdown>{post.body_md}</Markdown></div>}

        <div className="mt-8 flex items-center gap-2 border-t border-black/5 pt-5 text-sm">
          <form action={togglePostReactionAction}>
            <input type="hidden" name="post_id" value={post.id} />
            <button aria-pressed={post.reacted} className={`rounded-full px-4 py-2 font-semibold ring-1 ${post.reacted ? "bg-red-50 text-red-600 ring-red-200" : "ring-black/15 hover:ring-black/40"}`}>
              {post.reacted ? "♥" : "♡"} 공감{post.reactions > 0 && ` ${post.reactions}`}
            </button>
          </form>
          {mine && (
            <>
              <Link href={`/board/${post.id}/edit`} className="ml-auto rounded-full px-4 py-2 ring-1 ring-black/15 hover:ring-black/40">수정</Link>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-red-600 ring-1 ring-red-200">삭제</summary>
                <form action={deletePostAction.bind(null, post.id)} className="glass absolute right-0 z-10 mt-2 w-56 rounded-2xl p-4">
                  <p className="mb-3 text-xs text-black/60">댓글·공감도 함께 지워집니다.</p>
                  <SubmitButton busy="삭제하는 중…" className="w-full rounded-full bg-red-600 px-3 py-2 text-white">정말 삭제</SubmitButton>
                </form>
              </details>
            </>
          )}
        </div>
      </article>

      <Comments target={{ postId: post.id }} viewer={viewer} />
    </div>
  );
}

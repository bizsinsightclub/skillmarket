import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { countComments, listComments, type Comment, type Target } from "@/lib/community";
import { deleteCommentAction, toggleCommentReactionAction } from "@/lib/community-actions";
import type { Viewer } from "@/lib/queries";
import CommentForm from "@/components/comment-form";
import SubmitButton from "@/components/submit-button";

// 스킬 상세·게시판 글 아래 댓글 영역. 이 컴포넌트를 그리는 페이지가 먼저 글을 볼 수 있는지 확인한다.
export default async function Comments({ target, viewer }: { target: Target; viewer: Viewer }) {
  const list = await listComments(getDb(), target, viewer.id);
  const hidden: Record<string, number> = "skillId" in target ? { skill_id: target.skillId } : { post_id: target.postId };
  return (
    <section id="comments" className="panel scroll-mt-24 rounded-3xl p-6 sm:p-8">
      <h2 className="mb-4 text-lg font-extrabold tracking-[-0.02em]">
        댓글 <span className="font-semibold text-black/40">{countComments(list)}</span>
      </h2>
      <CommentForm hidden={hidden} placeholder="의견이나 써 본 후기를 남겨 주세요" />
      {list.length === 0 ? (
        <p className="mt-6 text-sm text-black/45">아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.</p>
      ) : (
        <ul className="mt-7 space-y-6">
          {list.map((c) => <Item key={c.id} c={c} hidden={hidden} viewer={viewer} />)}
        </ul>
      )}
    </section>
  );
}

function Item({ c, hidden, viewer }: { c: Comment; hidden: Record<string, number>; viewer: Viewer }) {
  return (
    <li id={`c${c.id}`} className="scroll-mt-24">
      <div className="flex items-baseline gap-2 text-sm">
        <b className={c.deleted ? "text-black/40" : ""}>{c.deleted ? "알 수 없음" : c.author}</b>
        <span className="text-xs text-black/40">{fmtDate(c.created_at, true)}</span>
      </div>
      {c.deleted ? (
        <p className="mt-1 text-sm text-black/40">삭제된 댓글입니다.</p>
      ) : (
        <>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{c.body}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-black/55">
            <form action={toggleCommentReactionAction}>
              <input type="hidden" name="comment_id" value={c.id} />
              <button aria-pressed={c.reacted} className={c.reacted ? "font-bold text-red-500" : "hover:text-ink"}>
                {c.reacted ? "♥" : "♡"} 공감{c.reactions > 0 && ` ${c.reactions}`}
              </button>
            </form>
            {/* 답글의 답글도 같은 줄기(최상위 댓글) 아래에 붙는다 */}
            <details className="open:basis-full">
              <summary className="cursor-pointer list-none hover:text-ink">답글</summary>
              <div className="mt-2">
                <CommentForm hidden={{ ...hidden, parent_id: c.parent_id ?? c.id }} placeholder={`${c.author} 님에게 답글`} reply />
              </div>
            </details>
            {(viewer.editor || viewer.id === c.author_id) && (
              <form action={deleteCommentAction}>
                <input type="hidden" name="comment_id" value={c.id} />
                <SubmitButton busy="지우는 중…" className="hover:text-red-600">삭제</SubmitButton>
              </form>
            )}
          </div>
        </>
      )}
      {c.replies.length > 0 && (
        <ul className="mt-4 space-y-4 border-l-2 border-black/5 pl-4 sm:pl-5">
          {c.replies.map((r) => <Item key={r.id} c={r} hidden={hidden} viewer={viewer} />)}
        </ul>
      )}
    </li>
  );
}

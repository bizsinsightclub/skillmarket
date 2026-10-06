import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { getPost } from "@/lib/community";
import { updatePostAction } from "@/lib/community-actions";
import PostForm from "@/components/post-form";

export default async function EditPostPage({ params }: PageProps<"/board/[id]/edit">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const { viewer } = await requireViewer();
  const post = await getPost(getDb(), id, viewer.id);
  if (!post || !(viewer.editor || viewer.id === post.author_id)) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <span hidden data-tab="/board" />
      <Link href="/board" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900"><span aria-hidden>←</span> AI Breakthrough 목록</Link>
      <h1 className="mb-6 text-3xl font-extrabold tracking-[-0.03em]">글 수정</h1>
      <PostForm action={updatePostAction.bind(null, id)} values={{ title: post.title, body_md: post.body_md, link_url: post.link_url }} submit="저장" />
    </div>
  );
}

import { requireViewer } from "@/lib/auth";
import { createPostAction } from "@/lib/community-actions";
import PostForm from "@/components/post-form";

export default async function NewPostPage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-3xl">
      <span hidden data-tab="/board" />
      <h1 className="mb-6 text-3xl font-extrabold tracking-[-0.03em]">AI Breakthrough 글쓰기</h1>
      <PostForm action={createPostAction} values={{ title: "", body_md: "", link_url: "" }} submit="올리기" />
    </div>
  );
}

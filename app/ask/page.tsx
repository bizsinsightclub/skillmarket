import { requireViewer } from "@/lib/auth";
import AskChat from "@/components/ask-chat";

// 원하는 스킬을 찾아주는 추천 챗봇(하이쿠). 로그인은 proxy.ts 가 이미 막는다.
export const metadata = { title: "AI에게 물어보기 · 스킬마켓" };

export default async function AskPage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">AI에게 물어보기</h1>
      <p className="mb-6 mt-1 text-sm text-black/50">하려는 일을 말로 적어주시면 맞는 스킬·플러그인을 찾아 드려요.</p>
      <AskChat />
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";

// 원하는 스킬을 찾아주는 추천 챗봇. 질문 → /api/ask → 설명 + 후보 카드.
// 설명(answer)은 Haiku, 카드(picks)는 의미 검색 결과(링크는 서버가 슬러그로 생성 → 환각 없음).
type Pick = { slug: string; name: string; summary: string; category_label: string; post_type: string; author_name: string; maker: string; thumb: string | null };
type Msg = { role: "user" | "assistant"; content: string; picks?: Pick[] };

const KIND_KO: Record<string, string> = { skill: "스킬", link: "플러그인·MCP", lens: "전문가 렌즈", app: "HTML 앱" };
const SUGGEST = ["슬라이드 잘 만드는 거", "회의록 자동 정리", "엑셀 데이터 분석", "코드 리뷰 도와주는 거"];

export default function AskChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data: { answer: string | null; picks: Pick[] } = await res.json();
      const answer = data.answer ?? (data.picks.length ? "관련 있을 만한 걸 찾아봤어요." : "딱 맞는 걸 못 찾았어요. 다르게 말해볼래요?");
      setMsgs([...history, { role: "assistant", content: answer, picks: data.picks }]);
    } catch {
      setMsgs([...history, { role: "assistant", content: "잠시 문제가 있었어요. 다시 시도해 주세요.", picks: [] }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={boxRef} className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="panel rounded-2xl p-5 text-sm text-black/60">
            <p className="font-semibold text-ink">무엇을 하고 싶으세요?</p>
            <p className="mt-1">하려는 일을 말로 적어주시면 맞는 스킬·플러그인을 찾아 드려요.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGEST.map((s) => (
                <button key={s} onClick={() => send(s)} className="glass rounded-full px-3 py-1.5 text-xs font-medium text-black/70 hover:text-ink">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end" : "self-start"}>
            {m.role === "user" ? (
              <p className="rounded-2xl bg-ink px-4 py-2 text-sm text-white">{m.content}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="whitespace-pre-wrap rounded-2xl glass px-4 py-3 text-sm leading-relaxed text-black/80">{m.content}</p>
                {!!m.picks?.length && (
                  <div className="flex flex-col gap-2">
                    {m.picks.map((p) => (
                      <Link key={p.slug} href={`/skills/${p.slug}`} className="panel flex items-center gap-3 rounded-xl p-3 hover:ring-2 hover:ring-accent/50">
                        {p.thumb && <img src={p.thumb} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                          <span className="block truncate text-xs text-black/50">{KIND_KO[p.post_type] ?? p.post_type} · {p.category_label} · {p.maker || `by ${p.author_name}`}</span>
                          {p.summary && <span className="mt-0.5 block truncate text-xs text-black/60">{p.summary}</span>}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="self-start glass rounded-2xl px-4 py-3 text-sm text-black/40">찾는 중…</p>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="예: 보고서용 슬라이드 빨리 만드는 스킬 있어?"
          className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-black/40 focus:border-black/30"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-50">보내기</button>
      </form>
    </div>
  );
}

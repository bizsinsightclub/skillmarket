import Link from "next/link";
import Catalog from "@/components/catalog";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { pluginTopicCounts } from "@/lib/queries";
import { PLUGIN_TOPICS } from "@/lib/topics";

// 플러그인·MCP 는 수가 압도적이라 분야 폴더로 먼저 나눈다. 분야(또는 검색) 고르면 그 리스트로 들어간다.
export default async function PluginsPage({ searchParams }: PageProps<"/plugins">) {
  const sp = await searchParams;
  const topic = typeof sp.topic === "string" ? sp.topic : "";
  const q = typeof sp.q === "string" ? sp.q : "";

  if (topic || q) {
    const label = PLUGIN_TOPICS.find((t) => t.slug === topic)?.label;
    return (
      <div>
        <span hidden data-tab="/plugins" />
        <Link href="/plugins" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-black/50 hover:text-ink">← 분야 전체</Link>
        <Catalog base="/plugins" title={label ? `플러그인·MCP · ${label}` : "플러그인·MCP"} kind="link" sp={sp} />
      </div>
    );
  }

  const { viewer } = await requireViewer();
  const counts = await pluginTopicCounts(getDb(), viewer);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <span hidden data-tab="/plugins" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-[-0.03em]">플러그인·MCP</h1>
          <p className="mt-1 text-sm text-black/50">{total}개 · 분야를 골라 들어가세요</p>
        </div>
        <Link href="/write?category=plugin" className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90">추천하기</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PLUGIN_TOPICS.map((t) => {
          const n = counts[t.slug] ?? 0;
          return (
            <Link key={t.slug} href={`/plugins?topic=${t.slug}`} className="panel group flex flex-col gap-3 rounded-2xl p-5 transition hover:ring-2 hover:ring-sky-300">
              <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 text-sky-500" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
              </svg>
              <span>
                <span className="block font-bold text-ink">{t.label}</span>
                <span className="mt-0.5 block text-sm tabular-nums text-black/45">{n}개</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

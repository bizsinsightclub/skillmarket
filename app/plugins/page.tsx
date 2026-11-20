import Link from "next/link";
import Catalog from "@/components/catalog";
import PluginMap from "@/components/plugin-map";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { pluginTopicCounts, pluginMap } from "@/lib/queries";
import { PLUGIN_TOPICS } from "@/lib/topics";

// 플러그인·MCP 는 수가 압도적이라 분야로 나눈다. 뷰 모드: 폴더(분야 그리드) · 그래프(스킬트리).
// 분야(또는 검색)를 고르면 그 리스트로 들어간다.
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

  const view = sp.view === "map" ? "map" : "folder";
  const subtitle = view === "map" ? "거리 = 실제 유사도 · 가까운 점은 비슷한 도구 (점을 눌러 보세요)" : "분야를 골라 들어가세요";
  const { viewer } = await requireViewer();
  const db = getDb();
  const VIEWS: [string, string, string][] = [["folder", "/plugins", "폴더"], ["map", "/plugins?view=map", "유사도 지도"]];

  return (
    <div>
      <span hidden data-tab="/plugins" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-[-0.03em]">플러그인·MCP</h1>
          <p className="mt-1 text-sm text-black/50">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass flex gap-1 rounded-2xl p-1 text-sm">
            {VIEWS.map(([k, href, label]) => (
              <Link key={k} href={href} className={`rounded-xl px-3 py-1.5 font-semibold ${view === k ? "bg-sky-600 text-white" : "text-black/60 hover:text-ink"}`}>{label}</Link>
            ))}
          </div>
          <Link href="/write?category=plugin" className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90">추천하기</Link>
        </div>
      </div>

      {view === "map" ? <MapView db={db} viewer={viewer} /> : <Folders db={db} viewer={viewer} />}
    </div>
  );
}

async function MapView({ db, viewer }: { db: ReturnType<typeof getDb>; viewer: Awaited<ReturnType<typeof requireViewer>>["viewer"] }) {
  const { nodes } = await pluginMap(db, viewer);
  return <PluginMap nodes={nodes} />;
}

async function Folders({ db, viewer }: { db: ReturnType<typeof getDb>; viewer: Awaited<ReturnType<typeof requireViewer>>["viewer"] }) {
  const counts = await pluginTopicCounts(db, viewer);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {PLUGIN_TOPICS.map((t) => (
        <Link key={t.slug} href={`/plugins?topic=${t.slug}`} className="panel group flex flex-col gap-3 rounded-2xl p-5 transition hover:ring-2 hover:ring-sky-300">
          <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 text-sky-500" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          </svg>
          <span>
            <span className="block font-bold text-ink">{t.label}</span>
            <span className="mt-0.5 block text-sm tabular-nums text-black/45">{counts[t.slug] ?? 0}개</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

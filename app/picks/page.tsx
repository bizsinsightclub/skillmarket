import Catalog from "@/components/catalog";

// 에디터 픽 = 에디터가 승인한 스킬·플러그인 전부. 최근에 선정된 순이 기본
export default async function PicksPage({ searchParams }: PageProps<"/picks">) {
  return <Catalog base="/picks" title="에디터 픽" onlyPicks sp={await searchParams} />;
}

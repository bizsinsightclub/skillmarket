import Catalog from "@/components/catalog";

// HTML 앱(대시보드·도구): 상세에서 격리된 화면으로 바로 실행해 볼 수 있는 HTML 파일 글
export default async function AppsPage({ searchParams }: PageProps<"/apps">) {
  return <Catalog base="/apps" title="HTML 앱" kind="app" sp={await searchParams} />;
}

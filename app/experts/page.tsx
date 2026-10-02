import Catalog from "@/components/catalog";
import TheLensIntro from "@/components/the-lens-intro";

export default async function ExpertsPage({ searchParams }: PageProps<"/experts">) {
  return <Catalog base="/experts" title="전문가 렌즈" kind="lens" intro={<TheLensIntro />} sp={await searchParams} />;
}

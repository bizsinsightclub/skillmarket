import Catalog from "@/components/catalog";
import TheLensIntro from "@/components/the-lens-intro";

export default async function ExpertsPage({ searchParams }: PageProps<"/experts">) {
  return <Catalog base="/experts" title="전문가 렌즈" kind="lens" intro={<TheLensIntro />} note={<>시스템 사용 문의는 <b className="text-lens-deep">김민석 프로</b>에게 연락해 주세요</>} sp={await searchParams} />;
}

import Catalog from "@/components/catalog";

export default async function SkillsPage({ searchParams }: PageProps<"/skills">) {
  return <Catalog base="/skills" title="스킬" kind="skill" sp={await searchParams} />;
}

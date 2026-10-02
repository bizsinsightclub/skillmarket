import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/queries";
import { createSkill } from "@/lib/skill-actions";
import SkillForm from "@/components/skill-form";

export default async function WritePage({ searchParams }: PageProps<"/write">) {
  const user = await requireUser();
  const categories = await listCategories(getDb());
  const want = (await searchParams).category; // /write?category=plugin 처럼 미리 고를 수 있게
  const category = categories.some((c) => c.slug === want) ? (want as string) : "etc";
  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-[-0.03em]">스킬·플러그인 올리기</h1>
      <SkillForm
        mode="create"
        action={createSkill}
        categories={categories}
        values={{
          name: "", summary: "", body_md: "", category, tags: "", maker: "", install_cmd: "", homepage_url: "",
          author_name: user.name, author_email: user.email, based_on: "", visibility: "public", access: "",
        }}
      />
    </div>
  );
}

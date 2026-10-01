import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/queries";
import { createSkill } from "@/lib/skill-actions";
import SkillForm from "@/components/skill-form";

export default async function WritePage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-[-0.03em]">스킬 올리기</h1>
      <SkillForm
        mode="create"
        action={createSkill}
        categories={await listCategories(getDb())}
        values={{
          name: "", summary: "", body_md: "", category: "etc", tags: "",
          author_name: user.name, author_email: user.email, based_on: "", visibility: "public", access: "",
        }}
      />
    </div>
  );
}

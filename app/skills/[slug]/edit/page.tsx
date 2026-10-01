import { notFound } from "next/navigation";
import { getDb, one } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { canEdit, getSkill, listAccess, listCategories, listSnapshots } from "@/lib/queries";
import { updateSkill } from "@/lib/skill-actions";
import SkillForm from "@/components/skill-form";

export default async function EditPage({ params }: PageProps<"/skills/[slug]/edit">) {
  const { slug } = await params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill || !canEdit(viewer, skill)) notFound();
  const [basedOn, categories, snapshots, access] = await Promise.all([
    skill.based_on_skill_id ? one<{ slug: string }>(db, "SELECT slug FROM app.skills WHERE id = $1", [skill.based_on_skill_id]) : undefined,
    listCategories(db),
    listSnapshots(db, skill.id),
    listAccess(db, skill.id),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-[-0.03em]">{skill.name} 수정</h1>
      <SkillForm
        mode="edit"
        action={updateSkill.bind(null, slug)}
        categories={categories}
        snapshots={snapshots}
        values={{
          name: skill.name, summary: skill.summary, body_md: skill.body_md, category: skill.category, tags: skill.tags,
          author_name: skill.author_name, author_email: skill.author_email, based_on: basedOn?.slug ?? "",
          visibility: skill.visibility, access: access.join("\n"),
        }}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { canEdit, getSkill, listVersions } from "@/lib/queries";
import { addVersion } from "@/lib/skill-actions";
import VersionForm from "./form";

// 1.2.3 → 1.2.4. 형식이 다르면 빈칸
function bump(v: string) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : "";
}

export default async function NewVersionPage({ params }: PageProps<"/skills/[slug]/versions/new">) {
  const { slug } = await params;
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill || !canEdit(viewer, skill)) notFound();
  const [latest] = await listVersions(db, skill.id);
  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold tracking-[-0.03em]">{skill.name} 새 버전</h1>
      <p className="mb-6 text-sm text-black/60">
        현재 v{latest.version}
        {skill.curated_version_id ? " · 큐레이티드는 검수를 다시 받기 전까지 기존 승인 버전을 유지합니다" : ""}
      </p>
      <VersionForm action={addVersion.bind(null, slug)} suggested={bump(latest.version)} />
    </div>
  );
}

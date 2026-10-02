import { one, type Db } from "./db.ts";

export class CurationError extends Error {}

// 에디터 픽 = 에디터가 승인한 것. 승인은 에디터가 검토한 그 버전(versionId)으로 고정된다.
// 검토 중 새 버전이 올라와도 영향 없음.
export async function review(
  db: Db,
  p: { skillId: number; versionId: number; editorId: number; decision: "approved" | "rejected"; note: string },
) {
  if (p.decision === "rejected" && !p.note.trim()) throw new CurationError("반려 사유를 입력하세요");
  await db.tx(async (t) => {
    if (!(await one(t, "SELECT 1 FROM app.skill_versions WHERE id = $1 AND skill_id = $2", [p.versionId, p.skillId]))) {
      throw new CurationError("스킬과 버전이 맞지 않습니다");
    }
    await t.query("INSERT INTO app.curation_reviews (skill_id, version_id, editor_id, decision, note) VALUES ($1, $2, $3, $4, $5)", [
      p.skillId, p.versionId, p.editorId, p.decision, p.note.trim(),
    ]);
    if (p.decision === "approved") {
      await t.query("UPDATE app.skills SET curation_status = 'approved', curated_version_id = $1 WHERE id = $2", [p.versionId, p.skillId]);
    } else {
      // 반려돼도 이전에 승인된 버전은 에디터 픽에 그대로 남는다
      await t.query("UPDATE app.skills SET curation_status = 'rejected' WHERE id = $1", [p.skillId]);
    }
  });
}

// 에디터 픽에서 내리기
export async function unpick(db: Db, skillId: number) {
  await db.query("UPDATE app.skills SET curated_version_id = NULL, curation_status = 'none' WHERE id = $1", [skillId]);
}

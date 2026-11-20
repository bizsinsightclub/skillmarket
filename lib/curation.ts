import { one, type Db } from "./db.ts";

export class CurationError extends Error {}

// 검수 필수(2026-10-12): 전사 공개 글은 링크형(플러그인·MCP·오픈소스)을 빼고 승인돼야 남에게 보인다.
// 승인은 에디터가 검토한 그 버전(versionId)으로 고정 → 이후 새 버전은 다시 승인받기 전까지 남에게 안 보인다.
// 에디터 픽은 승인과 별개: 승인된 글 중 에디터가 따로 고른 것(picked_at).
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
      await t.query("UPDATE app.snapshots SET pending = false WHERE skill_id = $1", [p.skillId]); // 에디터가 보고 승인한 데모는 공개
    } else {
      // 새 버전을 반려하면 이전 승인 버전은 그대로 공개. 지금 공개 중인 그 버전을 반려하면 승인 취소와 같다.
      await t.query(
        `UPDATE app.skills SET curation_status = 'rejected',
           curated_version_id = CASE WHEN curated_version_id = $2 THEN NULL ELSE curated_version_id END,
           picked_at = CASE WHEN curated_version_id = $2 THEN NULL ELSE picked_at END,
           revoked_at = CASE WHEN curated_version_id = $2 THEN now() ELSE revoked_at END
         WHERE id = $1`,
        [p.skillId, p.versionId],
      );
    }
    // 검토하는 사이 새 버전이 올라왔으면 다시 대기함으로(반려된 그 버전 때문에 되돌아가지는 않게, 더 새 버전이 있을 때만)
    if (await one(t, "SELECT 1 FROM app.skill_versions WHERE skill_id = $1 AND id > $2", [p.skillId, p.versionId])) await autoRequest(t, p.skillId);
  });
}

// 에디터 픽으로 고르기: 승인된 글만
export async function pick(db: Db, skillId: number) {
  const done = await db.query("UPDATE app.skills SET picked_at = now() WHERE id = $1 AND curated_version_id IS NOT NULL RETURNING 1", [skillId]);
  if (!done.length) throw new CurationError("승인된 글만 에디터 픽으로 고를 수 있습니다");
}

export async function unpick(db: Db, skillId: number) {
  await db.query("UPDATE app.skills SET picked_at = NULL WHERE id = $1", [skillId]);
}

// 승인 취소: 공개 후 문제가 드러났을 때. 검수 필수 글은 다시 승인받기 전까지 남에게 안 보이고,
// 취소 전에 승인됐던 옛 버전들도 더는 '승인된 버전'이 아니다(revoked_at).
export async function revoke(db: Db, skillId: number) {
  await db.query("UPDATE app.skills SET curated_version_id = NULL, curation_status = 'none', picked_at = NULL, revoked_at = now() WHERE id = $1", [skillId]);
}

// 승인 뒤 내용(이름·설명·이미지·데모 등)을 에디터가 아닌 사람이 고치면 다시 검수 대기함으로.
// ponytail: 고친 내용은 바로 보인다(오타 하나에 글이 숨지 않게) — 에디터가 대기함에서 확인 후 문제면 승인 취소.
export async function requeue(db: Db, skillId: number) {
  await db.query(
    `UPDATE app.skills s SET curation_status = 'pending' FROM app.categories c
     WHERE s.id = $1 AND c.slug = s.category AND c.post_type <> 'link' AND s.visibility = 'public' AND s.curation_status <> 'pending'`,
    [skillId],
  );
}

// 검수 필수 글인데 최신 버전이 승인 전이면 검수 대기함에 자동으로 올린다(새 글·새 버전·전사 공개로 전환).
export async function autoRequest(db: Db, skillId: number) {
  await db.query(
    `UPDATE app.skills s SET curation_status = 'pending'
     FROM app.categories c
     WHERE s.id = $1 AND c.slug = s.category AND c.post_type <> 'link' AND s.visibility = 'public' AND s.curation_status <> 'pending'
       AND s.curated_version_id IS DISTINCT FROM (SELECT MAX(v.id) FROM app.skill_versions v WHERE v.skill_id = s.id)`,
    [skillId],
  );
}

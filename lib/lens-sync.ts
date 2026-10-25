// The Lens(magilite) 저장소의 렌즈를 전문가 탭 글로 자동 등록·갱신한다.
// magilite 의 GitHub Actions 가 렌즈 파일이 바뀔 때마다 /api/lens-sync 로 렌즈 하나씩 보낸다.
// 이 파일은 요청 모양 검사와 DB 저장(테스트 대상). 파일 저장은 store 로 주입받는다(라우트는 lib/storage).
import { one, type Db } from "./db.ts";
import { UploadError, slugify, sniffImage } from "./skill-zip.ts";
import { MAX_LENS_BYTES, parseLensFile } from "./lens-file.ts";

export const MAX_PORTRAIT_BYTES = 3 * 1024 * 1024; // 요청 본문(4.5MB) 안에 base64 로 들어가야 한다
const LENS_ID = /^(EXPERT|LENS|METHOD)-\d{2}$/;
const TAG = "The Lens";

export type LensSyncInput = {
  lens_id: string; // The Lens 의 렌즈 id (EXPERT-09 등) — 같은 글을 다시 찾는 열쇠
  md: string; // 렌즈 .md 원문
  person: string;
  basis: string;
  summary: string;
  portrait: { ext: string; data: Uint8Array } | null; // 초상 → 썸네일
};
export type Store = { upload(path: string, data: Uint8Array, contentType: string): Promise<void>; remove(paths: string[]): Promise<void> };
export type Owner = { id: number; name: string; email: string };
export type SyncResult = { lens_id: string; slug: string; action: "created" | "updated" | "unchanged"; version: string };

function str(v: unknown, field: string, max: number, required = true) {
  if (typeof v !== "string") throw new UploadError(`${field} 는 문자열이어야 합니다`);
  const s = v.trim();
  if (required && !s) throw new UploadError(`${field} 가 비어 있습니다`);
  if (s.length > max) throw new UploadError(`${field} 는 ${max}자 이하여야 합니다`);
  return s;
}

// 요청 본문은 비밀키를 가진 쪽만 보낼 수 있지만, 모양은 업로드 화면과 같은 기준으로 다시 검사한다.
export function readSyncBody(body: unknown): LensSyncInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new UploadError("요청 본문이 JSON 객체가 아닙니다");
  const b = body as Record<string, unknown>;
  const lens_id = str(b.lens_id, "lens_id", 20);
  if (!LENS_ID.test(lens_id)) throw new UploadError("lens_id 형식이 아닙니다 (예: EXPERT-09)");
  const md = typeof b.md === "string" ? b.md.replace(/^﻿/, "").replace(/\r\n/g, "\n") : "";
  if (!md.trim() || new TextEncoder().encode(md).length > MAX_LENS_BYTES) throw new UploadError("md 가 비었거나 너무 큽니다");
  let portrait: LensSyncInput["portrait"] = null;
  if (b.portrait != null) {
    if (typeof b.portrait !== "string") throw new UploadError("portrait 는 base64 문자열이어야 합니다");
    const data = new Uint8Array(Buffer.from(b.portrait, "base64"));
    if (!data.length || data.length > MAX_PORTRAIT_BYTES) throw new UploadError("초상 이미지는 3MB 이하여야 합니다");
    const ext = sniffImage(data); // 확장자가 아니라 실제 바이트로 판별
    if (!ext) throw new UploadError("초상은 png·jpg·webp·gif 만 됩니다");
    portrait = { ext, data };
  }
  return { lens_id, md, person: str(b.person, "person", 40), basis: str(b.basis, "basis", 80), summary: str(b.summary ?? "", "summary", 200, false), portrait };
}

// 다음 버전: 가장 큰 x.y.z 의 y 를 올린다(1.0.0 → 1.1.0). 손으로 올린 버전 이름과 겹치면 더 올린다.
export function nextVersion(existing: string[]) {
  const nums = existing.map((v) => v.match(/^(\d+)\.(\d+)\.(\d+)$/)).filter(Boolean).map((m) => [Number(m![1]), Number(m![2])] as const);
  if (!nums.length) return existing.includes("1.0.0") ? "1.1.0" : "1.0.0";
  const [major, top] = nums.reduce((a, b) => (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a));
  let minor = top;
  let v = "";
  do v = `${major}.${++minor}.0`;
  while (existing.includes(v));
  return v;
}

async function uniqueSlug(db: Db, base: string) {
  let slug = base;
  for (let i = 2; await one(db, "SELECT 1 FROM app.skills WHERE slug = $1", [slug]); i++) slug = `${base}-${i}`;
  return slug;
}

// 렌즈 하나를 반영한다. 처음 보는 렌즈면 글을 만들고(검수 대기), 파일이 바뀌었으면 새 버전을 올리고(다시 검수 대기),
// 같으면 아무것도 하지 않는다 → 몇 번을 보내도 결과가 같다. 사이트에서 고친 이름·요약·태그는 덮어쓰지 않는다.
export async function syncLens(db: Db, store: Store, owner: Owner, input: LensSyncInput): Promise<SyncResult> {
  const lens = parseLensFile(input.md); // 전문가 탭 업로드와 같은 검사(펜스 블록·필수 절·길이)
  const bands = lens.operations.join(",");
  const written: string[] = [];
  const put = async (path: string, data: Uint8Array, type: string) => {
    await store.upload(path, data, type);
    written.push(path);
  };
  const putLens = (skillId: number, version: string) => {
    const path = `skills/${skillId}/versions/${version}.md`;
    return put(path, new TextEncoder().encode(input.md), "text/markdown; charset=utf-8").then(() => path);
  };
  const putPortrait = async (t: Db, skillId: number) => {
    if (!input.portrait || (await one(t, "SELECT 1 FROM app.snapshots WHERE skill_id = $1 AND kind = 'image'", [skillId]))) return; // 손으로 넣은 이미지는 그대로
    const { ext, data } = input.portrait;
    const path = `skills/${skillId}/snap/${crypto.randomUUID()}.${ext}`;
    await put(path, data, ext === "jpg" ? "image/jpeg" : `image/${ext}`);
    await t.query("INSERT INTO app.snapshots (skill_id, kind, path, sort_order) VALUES ($1, 'image', $2, 1)", [skillId, path]);
  };

  try {
    return await db.tx(async (t) => {
      let skill = await one<{ id: number; slug: string }>(t, "SELECT id, slug FROM app.skills WHERE lens_source = $1", [input.lens_id]);
      if (!skill) {
        // 자동 등록 전에 손으로 올려 둔 같은 렌즈는 이어받는다 — 기반 인물이 같은 렌즈 글이 딱 하나일 때만(애매하면 새 글)
        const manual = await t.query<{ id: number; slug: string }>(
          `SELECT s.id, s.slug FROM app.skills s JOIN app.categories c ON c.slug = s.category
           WHERE c.post_type = 'lens' AND s.lens_source IS NULL AND s.person = $1`,
          [input.person],
        );
        if (manual.length === 1) {
          skill = manual[0];
          await t.query("UPDATE app.skills SET lens_source = $1 WHERE id = $2", [input.lens_id, skill.id]);
        }
      }

      if (!skill) {
        const category = await one<{ slug: string }>(t, "SELECT slug FROM app.categories WHERE post_type = 'lens' ORDER BY sort_order LIMIT 1");
        if (!category) throw new UploadError("렌즈 분류가 없습니다");
        const slug = await uniqueSlug(t, slugify(input.lens_id, "expert"));
        const body = `${lens.preamble}\n\n---\n\nThe Lens 저장소에서 자동으로 올린 글입니다. 렌즈 파일이 바뀌면 새 버전이 자동으로 올라오고 다시 검수 대기가 됩니다.`;
        const { id } = (await one<{ id: number }>(
          t,
          `INSERT INTO app.skills (slug, name, summary, body_md, category, tags, author_name, author_email, owner_id, visibility,
                                   person, basis, bands, curation_status, lens_source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'public', $10, $11, $12, 'pending', $13) RETURNING id`,
          [slug, lens.name, input.summary, body, category.slug, TAG, owner.name || owner.email, owner.email, owner.id,
           input.person, input.basis, bands, input.lens_id],
        ))!;
        const version = "1.0.0";
        await t.query("INSERT INTO app.skill_versions (skill_id, version, zip_path, skill_md, uploaded_by, changelog) VALUES ($1, $2, $3, $4, $5, $6)", [
          id, version, await putLens(id, version), input.md, owner.id, "The Lens 자동 등록",
        ]);
        await putPortrait(t, id);
        return { lens_id: input.lens_id, slug, action: "created", version };
      }

      const versions = await t.query<{ version: string; skill_md: string }>(
        "SELECT version, skill_md FROM app.skill_versions WHERE skill_id = $1 ORDER BY created_at DESC, id DESC",
        [skill.id],
      );
      await putPortrait(t, skill.id);
      if (versions[0] && versions[0].skill_md.replace(/\r\n/g, "\n").trim() === input.md.trim()) {
        return { lens_id: input.lens_id, slug: skill.slug, action: "unchanged", version: versions[0].version };
      }
      const version = nextVersion(versions.map((v) => v.version));
      await t.query("INSERT INTO app.skill_versions (skill_id, version, zip_path, skill_md, uploaded_by, changelog) VALUES ($1, $2, $3, $4, $5, $6)", [
        skill.id, version, await putLens(skill.id, version), input.md, owner.id, "The Lens 저장소의 변경 반영",
      ]);
      // 에디터 픽은 승인된 버전을 계속 보여준다. 새 버전으로 바꾸려면 에디터가 다시 승인해야 하므로 검수 대기로 올린다.
      await t.query("UPDATE app.skills SET updated_at = now(), bands = $2, curation_status = 'pending' WHERE id = $1", [skill.id, bands]);
      return { lens_id: input.lens_id, slug: skill.slug, action: "updated", version };
    });
  } catch (e) {
    await store.remove(written); // DB 는 롤백됐으니 올린 파일도 지운다
    throw e;
  }
}

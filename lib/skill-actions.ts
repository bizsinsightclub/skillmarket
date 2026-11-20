"use server";

import crypto from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, one, type Db } from "./db";
import { requireUser, requireViewer } from "./auth";
import { normalizeEmail } from "./login";
import { canEdit, getSkill, setEmbedding, type Viewer } from "./queries";
import { embedOne } from "./embeddings";
import { MAX_ZIP_BYTES, UploadError, inFolder, installDirName, parseSkillZip, slugify, sniffImage, type ParsedSkill } from "./skill-zip";
import { LINK_VERSION, readLinkFields } from "./link-post";
import { MAX_LENS_BYTES, parseLensFile, type ParsedLens } from "./lens-file";
import { MAX_APP_BYTES, parseHtmlApp } from "./html-app";
import type { Kind } from "./queries";
import { download, remove, removeSkillFiles, signedUploadUrl, upload } from "./storage";
import { autoRequest, requeue, revoke } from "./curation";
import { CreditError, confirmAuthor, recordAuthor, report } from "./credit";
import { describe, scan, zipTexts } from "./sensitive";
import { sendAuthorConfirm } from "./mail";

export type FormState = { error?: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_DEMO_BYTES = 4 * 1024 * 1024; // 데모는 함수가 직접 응답하므로 Vercel 응답 한도(4.5MB) 아래
const MAX_ACCESS = 200;

// ── 1단계: 브라우저가 Storage 에 직접 올릴 1회용 업로드 URL 발급 ─────────────────────
// Vercel 함수는 요청 본문이 4.5MB 까지라 파일은 서버를 거치지 않는다. 검증은 2단계에서.

export type UploadSpec = { field: "zip" | "images" | "demo" | "lens" | "html"; name: string; size: number };
export type UploadTicket = { field: UploadSpec["field"]; path: string; token: string };

const LIMITS = { zip: [1, MAX_ZIP_BYTES], images: [MAX_IMAGES, MAX_IMAGE_BYTES], demo: [1, MAX_DEMO_BYTES], lens: [1, MAX_LENS_BYTES], html: [1, MAX_APP_BYTES] } as const;
const EXT = { zip: "zip", images: "img", demo: "html", lens: "md", html: "html" } as const;

export async function prepareUpload(specs: UploadSpec[]): Promise<{ tickets?: UploadTicket[]; error?: string }> {
  const user = await requireUser();
  // Server Action 인자는 브라우저가 마음대로 보낼 수 있다 → 모르는 field 가 섞이면 개수 제한을 비켜 간다
  if (!Array.isArray(specs) || specs.some((s) => !Object.hasOwn(LIMITS, s?.field) || typeof s.name !== "string" || !(Number(s.size) >= 0))) {
    return { error: "업로드 요청이 올바르지 않습니다" };
  }
  for (const field of Object.keys(LIMITS) as UploadSpec["field"][]) {
    const [maxCount, maxBytes] = LIMITS[field];
    const files = specs.filter((s) => s.field === field);
    if (files.length > maxCount) return { error: `${field} 파일이 너무 많습니다` };
    const big = files.find((f) => f.size > maxBytes);
    if (big) return { error: `파일이 너무 큽니다 (최대 ${Math.round(maxBytes / 1024)}KB): ${big.name}` };
  }
  if (specs.some((s) => (s.field === "demo" || s.field === "html") && !/\.html?$/i.test(s.name))) return { error: "HTML 은 .html 파일만 올릴 수 있습니다" };
  if (specs.some((s) => s.field === "lens" && !/\.md$/i.test(s.name))) return { error: "렌즈는 .md 파일만 올릴 수 있습니다" };

  const tickets: UploadTicket[] = [];
  for (const s of specs) {
    const path = `tmp/${user.id}/${crypto.randomUUID()}.${EXT[s.field]}`;
    tickets.push({ field: s.field, path, token: (await signedUploadUrl(path)).token });
  }
  return { tickets };
}

// ── 2단계: 폼 제출. 올라간 임시 파일을 내려받아 검증하고 최종 위치에 저장 ─────────────

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

// 자기가 발급받은 임시 경로만 받는다
function tmpPaths(form: FormData, userId: number) {
  const re = new RegExp(`^tmp/${userId}/[0-9a-f-]{36}\\.(zip|img|html|md)$`);
  const get = (k: string) => form.getAll(k).map(String).filter((p) => re.test(p));
  return { zip: get("zip_tmp")[0], images: get("images_tmp").slice(0, MAX_IMAGES), demo: get("demo_tmp")[0], lens: get("lens_tmp")[0], html: get("html_tmp")[0] };
}

type Meta = {
  name: string;
  summary: string;
  body_md: string;
  category: string;
  tags: string;
  author_name: string;
  author_email: string;
  based_on_skill_id: number | null;
  visibility: "public" | "restricted";
  access: string[];
  post_type: Kind; // skill(zip) · link(플러그인·MCP) · lens(전문가 렌즈 .md)
  maker: string;
  install_cmd: string;
  homepage_url: string;
  person: string;
  basis: string;
};

async function categoryType(db: Db, slug: string) {
  const cat = await one<{ post_type: Kind }>(db, "SELECT post_type FROM app.categories WHERE slug = $1", [slug]);
  if (!cat) throw new UploadError("분류가 올바르지 않습니다");
  return cat.post_type;
}

async function readLens(path: string): Promise<{ text: string; lens: ParsedLens }> {
  const data = await download(path);
  if (data.length > MAX_LENS_BYTES) throw new UploadError("렌즈 파일은 200KB 이하만 올릴 수 있습니다");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new UploadError("렌즈 파일은 UTF-8 텍스트(.md)여야 합니다");
  }
  return { text, lens: parseLensFile(text) };
}

// HTML 앱 파일: UTF-8·HTML 인지·4MB 검사, <title> 은 이름 기본값
async function readHtml(path: string | undefined) {
  if (!path) throw new UploadError("HTML 파일을 선택하세요");
  return parseHtmlApp(await download(path));
}

// 글쓰기·수정 공통 입력 검증. defaults 는 빈 칸일 때 채울 값(업로드 zip 의 frontmatter 등).
async function readMeta(db: Db, v: Viewer, form: FormData, defaults: Partial<Meta>, selfId?: number): Promise<Meta> {
  const name = text(form, "name", 80) || defaults.name || "";
  if (!name) throw new UploadError("이름을 입력하세요");
  const fromMd = defaults.summary ?? "";
  const summary = text(form, "summary", 200) || (fromMd.length > 200 ? fromMd.slice(0, 199) + "…" : fromMd); // 잘랐으면 … 로 표시

  const category = text(form, "category", 20) || "etc";
  const post_type = await categoryType(db, category);
  // 스킬·HTML 앱도 웹에 공개된 것을 가져왔으면 만든 곳 + 출처 주소(링크형처럼 'by 만든 곳 · 추천 ○○', 기여 집계 제외)
  const external = (post_type === "skill" || post_type === "app") && form.get("origin") === "external";
  if (external && !text(form, "homepage_url", 500)) throw new UploadError("출처 주소를 입력하세요");
  const link = post_type === "link" || external
    ? readLinkFields({ maker: text(form, "maker", 80), install_cmd: external ? "" : text(form, "install_cmd", 2000), homepage_url: text(form, "homepage_url", 500) })
    : { maker: "", install_cmd: "", homepage_url: "" };
  // 렌즈: 방법론의 출처 인물·방법론 이름은 '출처 표기'다(인물 연기가 아님 — The Lens 원칙)
  const lens = { person: "", basis: "" };
  if (post_type === "lens") {
    lens.person = text(form, "person", 40);
    lens.basis = text(form, "basis", 80);
    if (!lens.person || !lens.basis) throw new UploadError("기반 인물과 기반 방법론을 입력하세요");
  }

  const tags = [...new Set(text(form, "tags", 300).split(",").map((t) => t.trim().replace(/^#+/, "").trim()).filter(Boolean))].slice(0, 10).join(",");

  const author_name = text(form, "author_name", 50) || defaults.author_name || "";
  const author_email = normalizeEmail(text(form, "author_email", 200) || defaults.author_email || "");
  if (!author_name) throw new UploadError("원작자 이름을 입력하세요");
  if (!author_email) throw new UploadError("원작자(추천인) 이메일은 사내 메일(samsung.com·cheil.com)이어야 합니다");

  // 원본 스킬: slug 또는 게시글 주소
  let based_on_skill_id: number | null = null;
  const basedRaw = text(form, "based_on", 300);
  if (basedRaw) {
    const slug = basedRaw.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
    const base = await getSkill(db, v, { slug });
    if (!base) throw new UploadError(`원본 스킬을 찾을 수 없습니다: ${basedRaw}`);
    if (base.id === selfId) throw new UploadError("자기 자신을 원본으로 지정할 수 없습니다");
    based_on_skill_id = base.id;
  }

  const visibility = form.get("visibility") === "restricted" ? "restricted" : "public";
  const access: string[] = [];
  if (visibility === "restricted") {
    const bad: string[] = [];
    for (const raw of text(form, "access", 20000).split(/[\s,;]+/).filter(Boolean)) {
      const e = normalizeEmail(raw);
      if (e) access.push(e);
      else bad.push(raw);
    }
    if (bad.length) throw new UploadError(`사내 메일이 아닌 주소가 있습니다: ${bad.slice(0, 5).join(", ")}`);
    if (access.length > MAX_ACCESS) throw new UploadError(`공개 대상은 ${MAX_ACCESS}명까지입니다`);
  }

  return { name, summary, body_md: text(form, "body_md", 50000), category, tags, author_name, author_email, based_on_skill_id, visibility, access: [...new Set(access)], post_type, ...link, ...lens };
}

// 민감정보 검사: 입력한 글 + 올린 파일의 텍스트. 걸리면 UploadError 로 막는다.
function checkSensitive(viewer: Viewer, meta: Meta | null, files: Record<string, string>) {
  if (viewer.editor) return; // 에디터는 잘못 걸린 글을 대신 올릴 수 있게 건너뛴다
  const texts: Record<string, string> = { ...files };
  if (meta) {
    Object.assign(texts, {
      이름: meta.name, 요약: meta.summary, 설명: meta.body_md, 태그: meta.tags, "만든 곳": meta.maker,
      "설치 명령": meta.install_cmd, "공식 페이지": meta.homepage_url, "기반 인물": meta.person, "기반 방법론": meta.basis,
    });
  }
  const found = scan(texts);
  if (found.length) throw new UploadError(describe(found));
}

function versionTexts(parsed: ParsedSkill | null, lensText: string | null, html: string | null) {
  if (parsed) return zipTexts(parsed.zip);
  if (lensText !== null) return { "렌즈 파일": lensText };
  if (html !== null) return { "HTML 파일": html };
  return {};
}

function readVersion(form: FormData) {
  const version = text(form, "version", 20) || "1.0.0";
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,19}$/.test(version)) throw new UploadError("버전은 영문·숫자·. + - 만 쓸 수 있습니다 (예: 1.0.0)");
  return version;
}

async function readImages(paths: string[], existing: number) {
  if (existing + paths.length > MAX_IMAGES) throw new UploadError(`스냅샷 이미지는 ${MAX_IMAGES}장까지입니다`);
  const out: { ext: string; data: Uint8Array }[] = [];
  for (const p of paths) {
    const data = await download(p);
    if (data.length > MAX_IMAGE_BYTES) throw new UploadError("이미지는 장당 5MB 이하만 올릴 수 있습니다");
    const ext = sniffImage(data); // 확장자·MIME 이 아니라 실제 바이트로 판별
    if (!ext) throw new UploadError("png·jpg·webp·gif 이미지만 올릴 수 있습니다");
    out.push({ ext, data });
  }
  return out;
}

async function readDemo(path: string | undefined) {
  if (!path) return null;
  const data = await download(path);
  if (data.length > MAX_DEMO_BYTES) throw new UploadError("데모 HTML 은 4MB 이하만 올릴 수 있습니다");
  return data;
}

// 버전 파일 저장: 스킬은 다시 묶은 zip, 렌즈는 .md 원문, HTML 앱은 .html. 저장한 경로를 돌려준다(없으면 "")
async function storeVersionFile(skillId: number, slug: string, version: string, parsed: ParsedSkill | null, lensText: string | null, html: string | null = null) {
  if (html !== null) {
    const path = `skills/${skillId}/versions/${version}.html`;
    // text/plain: Storage 주소로 직접 열려도 실행되지 않게. 실행은 /skills/[slug]/app 이 격리 헤더를 붙여서만.
    await upload(path, new TextEncoder().encode(html), "text/plain; charset=utf-8");
    return path;
  }
  if (parsed) {
    const path = `skills/${skillId}/versions/${version}.zip`;
    await upload(path, inFolder(parsed.zip, installDirName(parsed.skillMd, slug)), "application/zip");
    return path;
  }
  if (lensText !== null) {
    const path = `skills/${skillId}/versions/${version}.md`;
    await upload(path, new TextEncoder().encode(lensText), "text/markdown; charset=utf-8");
    return path;
  }
  return "";
}

async function uniqueSlug(db: Db, base: string) {
  const taken = async (s: string) => !!(await one(db, "SELECT 1 FROM app.skills WHERE slug = $1", [s]));
  if (!(await taken(base))) return base;
  for (let i = 2; ; i++) if (!(await taken(`${base}-${i}`))) return `${base}-${i}`;
}

// demoPending = 데모를 재승인 전까지 남에게 감출지(비에디터가 공개 글의 데모를 바꾼 경우). 승인하면 review 가 푼다.
async function saveSnapshots(db: Db, skillId: number, images: { ext: string; data: Uint8Array }[], demo: Uint8Array | null, demoPending = false) {
  let order = (await one<{ n: number }>(db, "SELECT COALESCE(MAX(sort_order), 0)::int AS n FROM app.snapshots WHERE skill_id = $1", [skillId]))!.n + 1;
  const insert = (kind: string, path: string, pending = false) =>
    db.query("INSERT INTO app.snapshots (skill_id, kind, path, sort_order, pending) VALUES ($1, $2, $3, $4, $5)", [skillId, kind, path, order++, pending]);
  for (const img of images) {
    const path = `skills/${skillId}/snap/${crypto.randomUUID()}.${img.ext}`;
    await upload(path, img.data, img.ext === "jpg" ? "image/jpeg" : `image/${img.ext}`); // 판별한 타입으로 다시 저장
    await insert("image", path);
  }
  if (demo) {
    const path = `skills/${skillId}/snap/${crypto.randomUUID()}.html`;
    await upload(path, demo, "text/plain"); // Storage 에서 직접 열려도 HTML 로 실행되지 않게. 서빙은 /files 가 격리 헤더로.
    await insert("demo", path, demoPending);
  }
}

async function saveAccess(db: Db, skillId: number, emails: string[]) {
  await db.query("DELETE FROM app.skill_access WHERE skill_id = $1", [skillId]);
  for (const e of emails) await db.query("INSERT INTO app.skill_access (skill_id, email) VALUES ($1, $2)", [skillId, e]);
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

// 의미 검색용 임베딩 갱신(이름+요약+설명). 외부 API 라 커밋 뒤에, 실패해도 저장은 그대로(백필로 보완).
async function reembed(db: Db, slug: string) {
  try {
    const s = await one<{ id: number; name: string; summary: string; body_md: string }>(db, "SELECT id, name, summary, body_md FROM app.skills WHERE slug = $1", [slug]);
    if (!s) return;
    const vec = await embedOne(`${s.name}\n${s.summary}\n${s.body_md}`, "document");
    if (vec) await setEmbedding(db, s.id, vec);
  } catch (e) {
    console.error("[embed] 실패", e);
  }
}

async function editable(slug: string) {
  const { user, viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill || !canEdit(viewer, skill)) notFound();
  return { db, user, viewer, skill };
}

export async function createSkill(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, viewer } = await requireViewer();
  const db = getDb();
  const tmp = tmpPaths(form, user.id);
  let slug = "";
  let mailAuthor: { email: string; name: string } | null = null;
  try {
    if (form.get("agree") !== "on") throw new UploadError("등록 안내에 동의해 주세요");
    // 글 종류: 스킬(zip) / 플러그인·MCP(링크, 파일 없음) / 전문가 렌즈(.md)
    const type = await categoryType(db, text(form, "category", 20) || "etc");
    let parsed: ParsedSkill | null = null;
    let lensFile: { text: string; lens: ParsedLens } | null = null;
    if (type === "skill") {
      if (!tmp.zip) throw new UploadError("스킬 zip 파일을 선택하세요");
      parsed = parseSkillZip(await download(tmp.zip));
    }
    if (type === "lens") {
      if (!tmp.lens) throw new UploadError("렌즈 .md 파일을 선택하세요");
      lensFile = await readLens(tmp.lens);
    }
    const htmlFile = type === "app" ? await readHtml(tmp.html) : null;
    const meta = await readMeta(db, viewer, form, {
      name: parsed?.name ?? lensFile?.lens.name ?? (htmlFile?.title || undefined),
      summary: parsed?.description,
      author_name: user.name,
      author_email: user.email,
    });
    const version = type === "link" ? LINK_VERSION : readVersion(form);
    const images = await readImages(tmp.images, 0);
    const demo = await readDemo(tmp.demo);
    checkSensitive(viewer, meta, {
      ...versionTexts(parsed, lensFile?.text ?? null, htmlFile?.text ?? null),
      ...(demo ? { "데모 HTML": new TextDecoder().decode(demo) } : {}),
    });

    let skillId = 0;
    try {
      await db.tx(async (t) => {
        slug = await uniqueSlug(t, slugify(parsed?.name ?? meta.name, type === "lens" ? "expert" : type === "app" ? "app" : "skill"));
        skillId = (await one<{ id: number }>(
          t,
          `INSERT INTO app.skills (slug, name, summary, body_md, category, tags, author_name, author_email, owner_id, based_on_skill_id, visibility,
                                   maker, install_cmd, homepage_url, person, basis, bands, agreed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now()) RETURNING id`,
          [slug, meta.name, meta.summary, meta.body_md, meta.category, meta.tags, meta.author_name, meta.author_email, user.id, meta.based_on_skill_id, meta.visibility,
           meta.maker, meta.install_cmd, meta.homepage_url, meta.person, meta.basis, lensFile?.lens.operations.join(",") ?? ""],
        ))!.id;
        const zipPath = await storeVersionFile(skillId, slug, version, parsed, lensFile?.text ?? null, htmlFile?.text ?? null); // 링크형은 파일 없음("")
        await t.query("INSERT INTO app.skill_versions (skill_id, version, zip_path, skill_md, uploaded_by, changelog) VALUES ($1, $2, $3, $4, $5, $6)", [
          skillId, version, zipPath, parsed?.skillMd ?? lensFile?.text ?? "", user.id, "최초 등록",
        ]);
        await saveSnapshots(t, skillId, images, demo, !viewer.editor && meta.visibility === "public");
        await saveAccess(t, skillId, meta.access);
        if (await recordAuthor(t, { skillId, name: meta.author_name, email: meta.author_email, by: user, isLink: type === "link" || !!meta.maker })) {
          mailAuthor = { email: meta.author_email, name: meta.name };
        }
        await autoRequest(t, skillId); // 전사 공개(링크형 제외)는 승인돼야 남에게 보인다 → 바로 검수 대기함으로
      });
    } catch (e) {
      if (skillId) await removeSkillFiles(skillId); // DB 는 롤백됐으니 스토리지도 정리
      throw e;
    }
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  } finally {
    await remove([tmp.zip, tmp.lens, tmp.html, ...tmp.images, tmp.demo].filter(Boolean) as string[]);
  }
  const m = mailAuthor as { email: string; name: string } | null; // tx 콜백 안에서 채워져 TS 가 좁히지 못한다
  if (m) await sendAuthorConfirm(m.email, { skillName: m.name, uploader: user.name || user.email, slug });
  await reembed(db, slug);
  revalidatePath("/");
  redirect(`/skills/${slug}`);
}

export async function updateSkill(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { db, user, viewer, skill } = await editable(slug);
  const tmp = tmpPaths(form, user.id);
  const removedFiles: string[] = [];
  let mailAuthor = false;
  let meta: Meta;
  try {
    meta = await readMeta(db, viewer, form, {}, skill.id);
    if (meta.post_type !== skill.post_type) throw new UploadError("스킬·플러그인·전문가 렌즈 사이로는 분류를 바꿀 수 없습니다");
    const removeIds = new Set(form.getAll("remove_snapshot").map(Number));
    const current = await db.query<{ id: number; kind: string; path: string }>("SELECT id, kind, path FROM app.snapshots WHERE skill_id = $1", [skill.id]);
    const newDemo = await readDemo(tmp.demo);
    for (const s of current) if (s.kind === "demo" && newDemo) removeIds.add(s.id);
    const keptImages = current.filter((s) => s.kind === "image" && !removeIds.has(s.id)).length;
    const images = await readImages(tmp.images, keptImages);
    checkSensitive(viewer, meta, newDemo ? { "데모 HTML": new TextDecoder().decode(newDemo) } : {});
    const m = meta;

    await db.tx(async (t) => {
      await t.query(
        `UPDATE app.skills SET name = $1, summary = $2, body_md = $3, category = $4, tags = $5, author_name = $6, author_email = $7,
           based_on_skill_id = $8, visibility = $9, maker = $10, install_cmd = $11, homepage_url = $12, person = $13, basis = $14,
           updated_at = now() WHERE id = $15`,
        [m.name, m.summary, m.body_md, m.category, m.tags, m.author_name, m.author_email, m.based_on_skill_id, m.visibility,
         m.maker, m.install_cmd, m.homepage_url, m.person, m.basis, skill.id],
      );
      // 링크형은 설치 명령·주소가 버전 파일 대신이다 → 에디터 아닌 사람이 바꾸면 승인·에디터 픽을 내리고 다시 검수받게
      if (skill.post_type === "link" && !viewer.editor && (m.install_cmd !== skill.install_cmd || m.homepage_url !== skill.homepage_url)) {
        await revoke(t, skill.id);
      }
      mailAuthor = await recordAuthor(t, { skillId: skill.id, name: m.author_name, email: m.author_email, by: user, isLink: skill.post_type === "link" || !!m.maker });
      if (skill.visibility !== "public" && m.visibility === "public") await autoRequest(t, skill.id); // 지정 공개 → 전사 공개
      // 승인 뒤 보이는 내용을 에디터가 아닌 사람이 바꾸면 다시 검수 대기(저장만 누른 경우는 그대로)
      const changed = m.name !== skill.name || m.summary !== skill.summary || m.body_md !== skill.body_md || m.tags !== skill.tags
        || m.person !== skill.person || m.basis !== skill.basis || m.maker !== skill.maker || m.homepage_url !== skill.homepage_url || images.length > 0 || removeIds.size > 0 || !!newDemo;
      if (changed && !viewer.editor) await requeue(t, skill.id);
      for (const s of current) {
        if (!removeIds.has(s.id)) continue;
        await t.query("DELETE FROM app.snapshots WHERE id = $1", [s.id]);
        removedFiles.push(s.path);
      }
      await saveSnapshots(t, skill.id, images, newDemo, !viewer.editor && m.visibility === "public");
      await saveAccess(t, skill.id, meta.access);
    });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  } finally {
    await remove([...tmp.images, tmp.demo].filter(Boolean) as string[]);
  }
  await remove(removedFiles); // 커밋 후에만 파일 삭제
  if (mailAuthor) await sendAuthorConfirm(meta.author_email, { skillName: meta.name, uploader: user.name || user.email, slug });
  await reembed(db, slug);
  revalidatePath(`/skills/${slug}`);
  redirect(`/skills/${slug}`);
}

export async function addVersion(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { db, user, viewer, skill } = await editable(slug);
  if (skill.post_type === "link") notFound(); // 링크형 글엔 버전이 없다
  const tmp = tmpPaths(form, user.id);
  try {
    let parsed: ParsedSkill | null = null;
    let lensFile: { text: string; lens: ParsedLens } | null = null;
    const htmlFile = skill.post_type === "app" ? await readHtml(tmp.html) : null;
    if (skill.post_type === "lens") {
      if (!tmp.lens) throw new UploadError("렌즈 .md 파일을 선택하세요");
      lensFile = await readLens(tmp.lens);
    } else if (!htmlFile) {
      if (!tmp.zip) throw new UploadError("스킬 zip 파일을 선택하세요");
      parsed = parseSkillZip(await download(tmp.zip));
    }
    const version = readVersion(form);
    checkSensitive(viewer, null, { ...versionTexts(parsed, lensFile?.text ?? null, htmlFile?.text ?? null), "변경 내용": text(form, "changelog", 2000) });
    if (await one(db, "SELECT 1 FROM app.skill_versions WHERE skill_id = $1 AND version = $2", [skill.id, version])) {
      throw new UploadError(`이미 있는 버전입니다: ${version}`);
    }
    try {
      await db.tx(async (t) => {
        const path = await storeVersionFile(skill.id, skill.slug, version, parsed, lensFile?.text ?? null, htmlFile?.text ?? null);
        await t.query("INSERT INTO app.skill_versions (skill_id, version, zip_path, skill_md, uploaded_by, changelog) VALUES ($1, $2, $3, $4, $5, $6)", [
          skill.id, version, path, parsed?.skillMd ?? lensFile?.text ?? "", user.id, text(form, "changelog", 2000),
        ]);
        await t.query("UPDATE app.skills SET updated_at = now(), bands = COALESCE($2, bands) WHERE id = $1", [skill.id, lensFile ? lensFile.lens.operations.join(",") : null]);
        await autoRequest(t, skill.id); // 새 버전은 승인 전까지 남에게 안 보인다(이전 승인 버전은 그대로)
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new UploadError(`이미 있는 버전입니다: ${version}`);
      throw e;
    }
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  } finally {
    await remove([tmp.zip, tmp.lens, tmp.html].filter(Boolean) as string[]);
  }
  revalidatePath(`/skills/${slug}`);
  redirect(`/skills/${slug}`);
}

export async function deleteSkill(slug: string) {
  const { db, skill } = await editable(slug);
  await db.query("DELETE FROM app.skills WHERE id = $1", [skill.id]);
  await removeSkillFiles(skill.id);
  revalidatePath("/");
  redirect("/");
}

export async function toggleLike(slug: string) {
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();
  const removed = await db.query("DELETE FROM app.likes WHERE user_id = $1 AND skill_id = $2 RETURNING 1", [viewer.id, skill.id]);
  if (!removed.length) await db.query("INSERT INTO app.likes (user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [viewer.id, skill.id]);
  revalidatePath(`/skills/${slug}`);
}

// 써봤어요: 사용자당 1회 토글. 올린 사람·원작자 본인 것은 세지 않으므로 받지도 않는다.
export async function toggleUse(slug: string) {
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();
  if (skill.owner_id === viewer.id || skill.author_email === viewer.email) return;
  const removed = await db.query("DELETE FROM app.uses WHERE user_id = $1 AND skill_id = $2 RETURNING 1", [viewer.id, skill.id]);
  if (!removed.length) await db.query("INSERT INTO app.uses (user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [viewer.id, skill.id]);
  revalidatePath(`/skills/${slug}`);
}

// 원작자로 적힌 본인의 확인("맞아요" / "제가 아니에요")
export async function answerAuthor(slug: string, yes: boolean) {
  const { user, viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();
  try {
    await confirmAuthor(db, { skillId: skill.id, user, yes: yes === true }); // 인자는 브라우저가 마음대로 보낼 수 있다
  } catch (e) {
    if (!(e instanceof CreditError)) throw e; // 이미 답했거나 본인이 아니면 그냥 새로고침
  }
  revalidatePath(`/skills/${slug}`);
}

export async function reportSkill(slug: string, _prev: FormState, form: FormData): Promise<FormState & { done?: boolean }> {
  const { viewer } = await requireViewer();
  const db = getDb();
  const skill = await getSkill(db, viewer, { slug });
  if (!skill) notFound();
  try {
    await report(db, { skillId: skill.id, reporterId: viewer.id, reason: String(form.get("reason") ?? "") });
  } catch (e) {
    if (e instanceof CreditError) return { error: e.message };
    throw e;
  }
  revalidatePath("/editor");
  return { done: true };
}

export async function requestCuration(slug: string) {
  const { db, skill } = await editable(slug);
  await db.query("UPDATE app.skills SET curation_status = 'pending', updated_at = now() WHERE id = $1", [skill.id]);
  revalidatePath(`/skills/${slug}`);
}

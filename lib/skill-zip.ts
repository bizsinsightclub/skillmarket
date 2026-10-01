import { unzipSync, zipSync, strFromU8 } from "fflate";
import { parse as parseYaml } from "yaml";

export const MAX_ZIP_BYTES = 20 * 1024 * 1024;
export const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 500;

export class UploadError extends Error {}

export type ParsedSkill = {
  name: string; // frontmatter name
  description: string;
  skillMd: string;
  fileCount: number;
  zip: Uint8Array; // 정규화해서 다시 묶은 zip (SKILL.md 가 루트)
};

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/;

// 경로 탈출·절대경로·빈 세그먼트 거부. 역슬래시는 구분자로 취급.
function cleanPath(raw: string): string {
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) throw new UploadError(`허용되지 않는 경로: ${raw}`);
  const parts = p.split("/");
  if (parts.some((s) => s === ".." || s === "." || s === "")) throw new UploadError(`허용되지 않는 경로: ${raw}`);
  return p;
}

export function parseFrontmatter(md: string): Record<string, unknown> {
  const m = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try {
    const data = parseYaml(m[1]);
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseSkillZip(buf: Uint8Array): ParsedSkill {
  if (buf.length > MAX_ZIP_BYTES) throw new UploadError("zip 은 20MB 이하만 올릴 수 있습니다");

  let raw: Record<string, Uint8Array>;
  let total = 0;
  let count = 0;
  try {
    raw = unzipSync(buf, {
      // 선언된 크기로 먼저 거른다. fflate 는 선언 크기만큼만 풀어서 압축 폭탄도 이 한도에 묶인다.
      filter(f) {
        if (f.name.endsWith("/") || JUNK.test(f.name.replace(/\\/g, "/"))) return false;
        total += f.originalSize;
        if (++count > MAX_FILES) throw new UploadError(`파일은 ${MAX_FILES}개까지입니다`);
        if (total > MAX_UNZIPPED_BYTES) throw new UploadError("압축을 푼 크기가 50MB 를 넘습니다");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError("zip 파일을 읽을 수 없습니다");
  }

  let files: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(raw)) files[cleanPath(name)] = data;

  // 폴더째 압축한 경우(my-skill/SKILL.md) 최상위 폴더 한 겹을 벗긴다
  if (!files["SKILL.md"]) {
    const tops = new Set(Object.keys(files).map((p) => p.split("/")[0]));
    const [top] = tops;
    if (tops.size === 1 && files[`${top}/SKILL.md`]) {
      files = Object.fromEntries(Object.entries(files).map(([p, d]) => [p.slice(top.length + 1), d]));
    }
  }
  if (!files["SKILL.md"]) throw new UploadError("zip 최상위에 SKILL.md 가 없습니다");

  const skillMd = strFromU8(files["SKILL.md"]);
  const fm = parseFrontmatter(skillMd);
  const name = typeof fm.name === "string" ? fm.name.trim() : "";
  const description = typeof fm.description === "string" ? fm.description.trim() : "";
  if (!name || !description) throw new UploadError("SKILL.md 앞부분(frontmatter)에 name 과 description 이 필요합니다");

  return { name, description, skillMd, fileCount: Object.keys(files).length, zip: zipSync(files, { level: 6 }) };
}

// 설치 폴더 이름: frontmatter name 이 폴더명으로 쓸 만하면 그대로, 아니면 slug
export function installDirName(skillMd: string, slug: string) {
  const name = parseFrontmatter(skillMd).name;
  return typeof name === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(name) ? name : slug;
}

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "skill";
}

const IMAGE_SIGS: [string, (b: Uint8Array) => boolean][] = [
  ["png", (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ["jpg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["gif", (b) => strFromU8(b.subarray(0, 4)) === "GIF8"],
  ["webp", (b) => strFromU8(b.subarray(0, 4)) === "RIFF" && strFromU8(b.subarray(8, 12)) === "WEBP"],
];

// 확장자·MIME 을 믿지 않고 파일 앞부분 바이트로 판별
export function sniffImage(b: Uint8Array): string | null {
  return IMAGE_SIGS.find(([, test]) => b.length >= 12 && test(b))?.[0] ?? null;
}

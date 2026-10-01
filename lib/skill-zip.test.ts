import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, unzipSync, zipSync } from "fflate";
import { parseSkillZip, sniffImage, slugify, installDirName, UploadError } from "./skill-zip.ts";

const MD = "---\nname: my-skill\ndescription: >\n  여러 줄\n  설명\n---\n# 본문\n";
const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

test("정상 zip: frontmatter 파싱, 루트 SKILL.md", () => {
  const r = parseSkillZip(zip({ "SKILL.md": MD, "scripts/run.py": "print(1)" }));
  assert.equal(r.name, "my-skill");
  assert.equal(r.description, "여러 줄 설명");
  assert.equal(r.fileCount, 2);
});

test("폴더째 압축하면 한 겹 벗기고, 잡파일은 버린다", () => {
  const r = parseSkillZip(zip({ "my-skill/SKILL.md": MD, "my-skill/a.txt": "a", "__MACOSX/my-skill/._a.txt": "x", "my-skill/.DS_Store": "x" }));
  assert.deepEqual(Object.keys(unzipSync(r.zip)).sort(), ["SKILL.md", "a.txt"]);
});

test("경로 탈출·절대경로 거부", () => {
  for (const bad of ["../evil.sh", "a/../../evil", "/etc/passwd", "C:/x", "a\\..\\..\\x", "a//b"]) {
    assert.throws(() => parseSkillZip(zip({ "SKILL.md": MD, [bad]: "x" })), UploadError, bad);
  }
});

test("SKILL.md·frontmatter 없으면 거부, 깨진 zip 거부", () => {
  assert.throws(() => parseSkillZip(zip({ "README.md": "x" })), /SKILL\.md/);
  assert.throws(() => parseSkillZip(zip({ "SKILL.md": "# 제목만" })), /frontmatter/);
  assert.throws(() => parseSkillZip(zip({ "a/SKILL.md": MD, "b/x": "x" })), /SKILL\.md/);
  assert.throws(() => parseSkillZip(strToU8("not a zip")), UploadError);
});

test("압축 해제 크기 상한", () => {
  const big = new Uint8Array(51 * 1024 * 1024); // 0 으로 채워져 압축하면 아주 작다
  const z = zipSync({ "SKILL.md": strToU8(MD), "big.bin": big });
  assert.ok(z.length < 1024 * 1024);
  assert.throws(() => parseSkillZip(z), /50MB/);
});

test("이미지 판별은 바이트로", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(sniffImage(png), "png");
  assert.equal(sniffImage(strToU8("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(sniffImage(strToU8("<svg onload=alert(1)>")), null);
});

test("slug·설치 폴더명", () => {
  assert.equal(slugify("Web Slide Deck!"), "web-slide-deck");
  assert.equal(slugify("한글 이름"), "skill");
  assert.equal(installDirName(MD, "x"), "my-skill");
  assert.equal(installDirName("---\nname: 한글\n---", "fallback"), "fallback");
});

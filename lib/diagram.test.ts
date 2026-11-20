import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { unpackForReading, withPretendard } from "./diagram.ts";

test("withPretendard: 쓰인 글자 조각만 내장 + 글꼴 덮어쓰기, 두 번 적용해도 그대로", async () => {
  const html = "<html><head><title>t</title></head><body><svg><text>조사 요청</text></svg></body></html>";
  const out = await withPretendard(html);
  assert.match(out, /skillmarket-pretendard/);
  assert.match(out, /font-family:'Pretendard Variable'[^}]*!important/);
  const faces = (out.match(/@font-face/g) ?? []).length;
  assert.ok(faces >= 1 && faces < 92, `조각 ${faces}개`); // 전부가 아니라 필요한 것만
  assert.equal(await withPretendard(out), out);
});

test("unpackForReading: 파일을 풀되 ../ 경로 탈출은 버린다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "unpack-"));
  try {
    const zip = zipSync({ "s/SKILL.md": strToU8("# hi"), "s/scripts/a.py": strToU8("print(1)"), "../evil.txt": strToU8("x") });
    const dest = join(dir, "files");
    await unpackForReading(zip, dest);
    assert.equal(await readFile(join(dest, "s", "SKILL.md"), "utf-8"), "# hi");
    assert.deepEqual((await readdir(dir)).sort(), ["files"]); // evil.txt 가 바깥에 생기지 않음
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { skillContext } from "./diagram.ts";

test("skillContext: 파일 목록 + SKILL.md 전문 + 스크립트 앞부분, 바이너리는 목록에만, 6만 자 상한", () => {
  const zip = zipSync({
    "my-skill/SKILL.md": strToU8("---\nname: my-skill\n---\n# 하는 일\n단계 1 → 단계 2"),
    "my-skill/scripts/run.py": strToU8("print('hi')\n" + "x".repeat(10_000)),
    "my-skill/assets/logo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    "my-skill/references/big.md": strToU8("y".repeat(200_000)),
  });
  const c = skillContext(zip);
  assert.match(c, /my-skill\/assets\/logo\.png \(4B\)/); // 목록엔 있음
  assert.ok(!c.includes("\x89PNG")); // 내용은 안 읽음
  assert.match(c, /단계 1 → 단계 2/);
  assert.match(c, /print\('hi'\)/);
  assert.ok(c.length <= 60_000);
});

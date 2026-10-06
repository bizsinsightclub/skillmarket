import { test } from "node:test";
import assert from "node:assert/strict";
import { fitText } from "./format.ts";

test("fitText: 짧으면 그대로, 길면 문장 단위, 첫 문장이 길면 어절에서 끊고 …", () => {
  assert.equal(fitText("  짧은  글 ", 20), "짧은 글");
  assert.equal(fitText("첫 문장이에요. 두 번째 문장은 꽤 길어서 들어가지 않아요.", 20), "첫 문장이에요.");
  const long = fitText("아주 긴 첫 문장이 끝없이 이어지면서 칸을 넘어가는 경우에는 어절에서 끊어야 합니다", 30);
  assert.ok(long.length <= 30 && long.endsWith("…"), long);
  assert.doesNotMatch(long, / …$/);
  assert.ok("아주 긴 첫 문장이 끝없이 이어지면서 칸을 넘어가는".startsWith(long.slice(0, -1)));
});

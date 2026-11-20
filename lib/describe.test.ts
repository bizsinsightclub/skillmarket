import { test } from "node:test";
import assert from "node:assert/strict";
import { githubRepo, describeTool } from "./describe.ts";

test("githubRepo: github.com 저장소만 owner/repo 로, 그 외는 null", () => {
  assert.equal(githubRepo("https://github.com/nvidia/skillspector"), "nvidia/skillspector");
  assert.equal(githubRepo("https://github.com/a/b.git"), "a/b");
  assert.equal(githubRepo("https://github.com/a/b/tree/main/x"), "a/b");
  assert.equal(githubRepo("https://hyperframes.heygen.com"), null);
  assert.equal(githubRepo("https://github.com.evil.io/a/b"), null);
  assert.equal(githubRepo("http://169.254.169.254/a/b"), null);
});

test("describeTool: 키 없으면 null(재시도), GitHub 아니면 ''(근거 없음)", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(await describeTool("x", "y", "https://github.com/a/b"), null);
  process.env.ANTHROPIC_API_KEY = "test";
  assert.equal(await describeTool("x", "y", "https://example.com"), "");
  if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved;
});

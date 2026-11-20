import { test } from "node:test";
import assert from "node:assert/strict";
import { githubRepo, describeTool, makeGists, gistText } from "./describe.ts";

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

test("makeGists: 키 없으면 전부 null(크론이 재시도), gistText 는 요약+AI 소개", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.deepEqual(await makeGists([{ name: "a", text: "b" }, { name: "c", text: "d" }]), [null, null]);
  if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  assert.equal(gistText("요약", null), "요약");
  assert.equal(gistText("요약", "소개"), "요약 소개");
});

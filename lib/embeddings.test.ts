import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, embed, embedOne } from "./embeddings.ts";

test("코사인 유사도: 같으면 1, 직교면 0, 길이 다르면 0", () => {
  assert.equal(cosine([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.ok(cosine([1, 2, 3], [2, 4, 6]) > 0.999); // 같은 방향
  assert.equal(cosine([1, 2, 3], [1, 2]), 0); // 길이 불일치
  assert.equal(cosine([0, 0], [1, 1]), 0); // 0 벡터
});

test("VOYAGE_API_KEY 없으면 null (기존 키워드 검색으로 폴백)", async () => {
  const saved = process.env.VOYAGE_API_KEY;
  delete process.env.VOYAGE_API_KEY;
  try {
    assert.equal(await embed(["x"], "query"), null);
    assert.equal(await embedOne("슬라이드", "query"), null);
  } finally {
    if (saved !== undefined) process.env.VOYAGE_API_KEY = saved;
  }
});

test("빈 입력은 null", async () => {
  assert.equal(await embedOne("   ", "document"), null);
});

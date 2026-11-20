import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { pluginMap, pca2d, plainExcerpt, type Viewer } from "./queries.ts";

const viewer: Viewer = { id: 1, email: "owner@samsung.com", editor: false };
const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com');
  INSERT INTO app.skills (id, slug, name, category, author_name, author_email, owner_id, visibility, topic, embedding) OVERRIDING SYSTEM VALUE VALUES
    (1, 'a', 'A', 'oss', 'X', 'owner@samsung.com', 1, 'public', 'dev', '{1,0}'),
    (2, 'b', 'B', 'oss', 'X', 'owner@samsung.com', 1, 'public', 'dev', '{1,0}'),
    (3, 'c', 'C', 'oss', 'X', 'owner@samsung.com', 1, 'public', 'data', '{0,1}');
`;

test("pca2d: 같은 벡터는 같은 좌표, 다른 벡터는 떨어진다", () => {
  const pts = pca2d([[1, 0], [1, 0], [0, 1]]);
  assert.equal(pts.length, 3);
  // A·B 동일 벡터 → 같은 자리
  assert.ok(Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) < 1e-6);
  // C 는 직교 → A 와 떨어져 있다
  assert.ok(Math.hypot(pts[0][0] - pts[2][0], pts[0][1] - pts[2][1]) > 1);
});

test("pca2d: 임베딩 없는 점은 원점, 1개 미만이면 전부 원점", () => {
  const pts = pca2d([null, [1, 2]]);
  assert.deepEqual(pts[0], [0, 0]); // null → 원점
  assert.deepEqual(pts[1], [0, 0]); // 유효 1개뿐이라 투영 불가 → 원점
});

test("pluginMap: 보이는 링크형을 좌표+최근접 이웃으로", async () => {
  const db = await testDb(SEED);
  const { nodes } = await pluginMap(db, viewer);
  assert.equal(nodes.length, 3);
  const a = nodes.find((n) => n.slug === "a")!;
  // A 의 최근접 이웃 1위는 동일 벡터 B(유사도 1), 직교 C 는 임계 미만이라 빠진다
  assert.equal(a.near[0]?.slug, "b");
  assert.ok(a.near[0].sim > 0.99);
  assert.ok(!a.near.some((x) => x.slug === "c"));
  assert.ok(typeof a.x === "number" && typeof a.y === "number");
});

test("plainExcerpt: 마크다운 문법·코드블록 제거 + 길이 제한", () => {
  const md = "# 제목\n\n- **굵게** 항목\n- [링크](https://x.y) 설명\n\n```bash\nnpm i\n```\n![img](a.png) open-source 끝";
  assert.equal(plainExcerpt(md), "굵게 항목 링크 설명 open-source 끝"); // 제목 줄은 버림
  assert.equal(plainExcerpt("가".repeat(400), 10), "가".repeat(10) + "…");
});

test("plainExcerpt: 브리핑 글 — 구분선 뒤·링크만 있는 줄·요약 중복 제거", () => {
  const md = "## 소개\n\n마케팅 스킬 모음입니다.\n\n[GitHub 저장소](https://github.com/a/b)\n\n설치 후 /mk 로 부릅니다.\n\n---\n\n바이브코딩 아침 브리핑에서 자동으로 올린 글입니다.";
  assert.equal(plainExcerpt(md, 320, "마케팅 스킬 모음입니다."), "설치 후 /mk 로 부릅니다.");
  assert.equal(plainExcerpt(md.replace("설치 후 /mk 로 부릅니다.\n\n", ""), 320, "마케팅 스킬 모음입니다."), ""); // 요약뿐이면 빈 발췌
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { pluginMap, pca2d, type Viewer } from "./queries.ts";

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

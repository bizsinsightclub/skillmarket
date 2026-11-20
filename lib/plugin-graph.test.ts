import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { pluginGraph, pluginMatrix, type Viewer } from "./queries.ts";

const viewer: Viewer = { id: 1, email: "owner@samsung.com", editor: false };
const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com');
  INSERT INTO app.skills (id, slug, name, category, author_name, author_email, owner_id, visibility, topic, embedding) OVERRIDING SYSTEM VALUE VALUES
    (1, 'a', 'A', 'oss', 'X', 'owner@samsung.com', 1, 'public', 'dev', '{1,0}'),
    (2, 'b', 'B', 'oss', 'X', 'owner@samsung.com', 1, 'public', 'dev', '{1,0}'),
    (3, 'c', 'C', 'oss', 'X', 'owner@samsung.com', 1, 'public', 'data', '{0,1}');
`;

test("pluginGraph: 유사한 노드끼리만 엣지(코사인 임계 이상)", async () => {
  const db = await testDb(SEED);
  const { nodes, edges } = await pluginGraph(db, viewer);
  assert.equal(nodes.length, 3);
  assert.equal(edges.length, 1); // A↔B 만(같은 벡터), C 는 직교라 연결 없음
  assert.deepEqual(edges[0], [0, 1]);
});

test("pluginMatrix: 각 행이 7개 분야 관련도, 자기 분야가 가장 높다", async () => {
  const db = await testDb(SEED);
  const { topics, rows } = await pluginMatrix(db, viewer);
  assert.equal(topics.length, 7);
  assert.equal(rows.length, 3);
  const dev = topics.findIndex((t) => t.slug === "dev");
  const data = topics.findIndex((t) => t.slug === "data");
  const devRow = rows.find((r) => r.topic === "dev")!;
  assert.equal(devRow.rels.length, 7);
  assert.ok(devRow.rels[dev] > 0.99); // 자기 분야 중심과 동일 벡터
  assert.ok(devRow.rels[data] < 0.01); // 직교 분야
});

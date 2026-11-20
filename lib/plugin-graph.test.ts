import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { pluginGraph, type Viewer } from "./queries.ts";

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

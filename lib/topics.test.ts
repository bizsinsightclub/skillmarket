import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { pluginTopicCounts, type Viewer } from "./queries.ts";
import { classifyTopics, topicLabel } from "./topics.ts";

delete process.env.ANTHROPIC_API_KEY;

const viewer: Viewer = { id: 1, email: "owner@samsung.com", editor: false };
const SEED = `
  INSERT INTO app.users (id, email) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com');
  INSERT INTO app.skills (id, slug, name, category, author_name, author_email, owner_id, visibility, topic) OVERRIDING SYSTEM VALUE VALUES
    (1, 'a', '깃 도구', 'oss', 'A', 'owner@samsung.com', 1, 'public', 'dev'),
    (2, 'b', '린터', 'oss', 'A', 'owner@samsung.com', 1, 'public', 'dev'),
    (3, 'c', '미분류', 'oss', 'A', 'owner@samsung.com', 1, 'public', NULL),
    (4, 's', '스킬', 'etc', 'A', 'owner@samsung.com', 1, 'public', NULL);  -- 링크형 아님 → 집계 제외
`;

test("pluginTopicCounts: 보이는 링크형만 분야별로, 미분류는 etc", async () => {
  const db = await testDb(SEED);
  const counts = await pluginTopicCounts(db, viewer);
  assert.equal(counts.dev, 2);
  assert.equal(counts.etc, 1); // NULL topic 링크형 1개
  assert.equal(counts.skill, undefined); // 스킬(category=etc, post_type=skill)은 안 센다
});

test("classifyTopics: ANTHROPIC 키 없으면 모두 etc", async () => {
  assert.deepEqual(await classifyTopics([{ name: "x", summary: "y" }, { name: "z", summary: "" }]), ["etc", "etc"]);
  assert.equal(topicLabel("dev"), "개발");
  assert.equal(topicLabel(null), "기타");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { parseBriefing, ingestBriefing, htmlText } from "./briefing.ts";

const MAIL = `매일 아침 바이브코딩 브리핑 미리보기입니다.

[10월 1주차 GitHub 트렌딩 TOP 10]

1. VoiceStudio — 주간 1위
https://github.com/debpalash/VoiceStudio
내 컴퓨터에서 완전히 로컬로 동작하는 오픈소스 ElevenLabs 대안이에요.
646개 언어로 지원합니다.

2. hindsight
https://github.com/vectorize-io/hindsight
AI 에이전트에게 장기 기억력을 심어주는 오픈소스 메모리 시스템이에요.

4. ponytail
https://github.com/DietrichGebert/ponytail
게으른 시니어 개발자 프롬프트 스킬.

7. ai-engineering-from-scratch
https://github.com/rohitg00/ai-engineering-from-scratch
무료 커리큘럼.

[이번 주 깃허브 클로드 스킬·플러그인 TOP 3]

11. fast-jev-compaction (별 7,398개)
https://github.com/tamaratran/fast-jev-compaction
Claude Code 플러그인.

---
매일 아침 8시 18분쯤 발송됩니다.
`;

test("브리핑 본문 해석: 묶음·이름·저장소·설명, 별 개수·끝 인사말은 버린다", () => {
  const items = parseBriefing(MAIL);
  assert.deepEqual(items.map((i) => i.name), ["VoiceStudio", "hindsight", "ponytail", "ai-engineering-from-scratch", "fast-jev-compaction"]);
  assert.equal(items[0].url, "https://github.com/debpalash/VoiceStudio");
  assert.equal(items[0].maker, "debpalash");
  assert.equal(items[0].section, "10월 1주차 GitHub 트렌딩 TOP 10");
  assert.equal(items[4].section, "이번 주 깃허브 클로드 스킬·플러그인 TOP 3");
  assert.match(items[0].summary, /ElevenLabs 대안이에요\. 646개 언어/);
  assert.equal(items[4].summary, "Claude Code 플러그인.");
});

test("HTML 메일도 같은 결과", () => {
  const html = MAIL.split("\n\n").map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join("");
  assert.deepEqual(parseBriefing(htmlText(html)), parseBriefing(MAIL));
});

test("저장: 검수 대기로, 묶음에 맞는 분류, 이미 있는 글은 건너뛴다", async () => {
  const db = await testDb(`
    INSERT INTO app.users (id, email, name) OVERRIDING SYSTEM VALUE VALUES (1, 'ed@samsung.com', '에디터');
    INSERT INTO app.skills (slug, name, summary, body_md, category, tags, author_name, author_email, owner_id, homepage_url) VALUES
      ('ponytail', 'ponytail', '', '', 'plugin', '', 'x', 'ed@samsung.com', 1, 'https://github.com/dietrichgebert/ponytail'),
      ('ai-engineering-from-scratch', 'AI Engineering from Scratch', '', '', 'oss', '', 'x', 'ed@samsung.com', 1, 'https://aiengineeringfromscratch.com');
  `);
  const owner = { id: 1, name: "에디터", email: "ed@samsung.com" };
  const items = parseBriefing(MAIL);
  assert.deepEqual(await ingestBriefing(db, items, owner, "브리핑"), ["voicestudio", "hindsight", "fast-jev-compaction"]);
  assert.deepEqual(await ingestBriefing(db, items, owner, "브리핑"), []); // 다시 돌려도 중복 없음
  const rows = await db.query<{ slug: string; curation_status: string; category: string; n: number }>(
    `SELECT s.slug, s.curation_status, s.category, (SELECT COUNT(*)::int FROM app.skill_versions v WHERE v.skill_id = s.id) AS n
     FROM app.skills s WHERE s.slug IN ('voicestudio', 'fast-jev-compaction') ORDER BY s.slug`,
  );
  assert.deepEqual(rows, [
    { slug: "fast-jev-compaction", curation_status: "pending", category: "plugin", n: 1 },
    { slug: "voicestudio", curation_status: "pending", category: "oss", n: 1 },
  ]);
});

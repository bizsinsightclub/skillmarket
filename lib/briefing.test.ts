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

광고 없는 링크 https://example.com
좋은 하루 보내세요!
`;

test("브리핑 본문 해석: 이름·저장소·설명, 끝 인사말은 버린다", () => {
  const { heading, items } = parseBriefing(MAIL);
  assert.equal(heading, "10월 1주차 GitHub 트렌딩 TOP 10");
  assert.deepEqual(items.map((i) => i.name), ["VoiceStudio", "hindsight", "ponytail"]);
  assert.equal(items[0].url, "https://github.com/debpalash/VoiceStudio");
  assert.equal(items[0].maker, "debpalash");
  assert.match(items[0].summary, /ElevenLabs 대안이에요\. 646개 언어/);
  assert.doesNotMatch(items[2].summary, /좋은 하루/);
});

test("HTML 메일도 같은 결과", () => {
  const html = MAIL.split("\n\n").map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join("");
  assert.deepEqual(parseBriefing(htmlText(html)).items.map((i) => i.url), parseBriefing(MAIL).items.map((i) => i.url));
});

test("저장: 검수 대기로, 같은 저장소(대소문자 무시)·같은 이름은 건너뛴다", async () => {
  const db = await testDb(`
    INSERT INTO app.users (id, email, name) OVERRIDING SYSTEM VALUE VALUES (1, 'ed@samsung.com', '에디터');
    INSERT INTO app.skills (slug, name, summary, body_md, category, tags, author_name, author_email, owner_id, homepage_url)
    VALUES ('ponytail', 'ponytail', '', '', 'plugin', '', 'x', 'ed@samsung.com', 1, 'https://github.com/dietrichgebert/ponytail');
  `);
  const owner = { id: 1, name: "에디터", email: "ed@samsung.com" };
  const { items } = parseBriefing(MAIL);
  assert.deepEqual(await ingestBriefing(db, items, owner, "브리핑"), ["voicestudio", "hindsight"]);
  assert.deepEqual(await ingestBriefing(db, items, owner, "브리핑"), []); // 다시 돌려도 중복 없음
  const rows = await db.query<{ curation_status: string; category: string; n: number }>(
    "SELECT s.curation_status, s.category, (SELECT COUNT(*)::int FROM app.skill_versions v WHERE v.skill_id = s.id) AS n FROM app.skills s WHERE s.slug = 'voicestudio'",
  );
  assert.deepEqual(rows, [{ curation_status: "pending", category: "oss", n: 1 }]);
});

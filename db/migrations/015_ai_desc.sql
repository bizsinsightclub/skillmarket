SET LOCAL search_path TO app;

-- 링크형(플러그인·오픈소스) 소개: 저장소 README 를 Haiku 가 읽고 정리한 한국어 3~4문장(lib/describe.ts).
-- 사람이 쓴 body_md 와 분리해 덮어쓰지 않는다. NULL = 아직 안 만듦(enrich 크론이 채움), '' = 만들 근거 없음(README 없음·GitHub 아님 → 재시도 안 함).
ALTER TABLE skills ADD COLUMN ai_desc text;

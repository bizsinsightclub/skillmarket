SET LOCAL search_path TO app;

-- 스킬 구조도(archify, https://github.com/tt-a1i/archify, vendor/archify) + 원리 설명. 매일 13:00 KST enrich 크론이 승인된 새 버전에 만든다(lib/diagram.ts, 수동은 npm run diagram).
-- 버전마다 구조가 다르므로 버전별. diagram_path = Storage 의 archify HTML(text/plain 으로 저장, 격리 iframe 으로만 연다), NULL = 아직, '' = 실패(재시도 안 함).
-- principle = 한국어 마크다운(언제 쓰나·동작 순서·핵심 장치·결과물).
ALTER TABLE skill_versions ADD COLUMN diagram_path text;
ALTER TABLE skill_versions ADD COLUMN principle text;

-- 링크형 GitHub 스타 수(유사도 지도 '스타' 크기 토글). enrich 크론이 오래된 것부터 갱신(인증 없는 GitHub API 시간당 60회 → 하루 40개씩).
ALTER TABLE skills ADD COLUMN stars int;
ALTER TABLE skills ADD COLUMN stars_at timestamptz;

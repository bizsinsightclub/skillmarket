-- 글 종류를 3가지로: skill(zip) · link(플러그인·MCP) · lens(The Lens 렌즈 .md — 전문가 탭)
-- needs_zip 은 post_type 으로 대체(코드는 post_type 만 쓴다. needs_zip 컬럼은 다음 정리 때 삭제)
ALTER TABLE app.categories ADD COLUMN post_type text NOT NULL DEFAULT 'skill' CHECK (post_type IN ('skill', 'link', 'lens'));
UPDATE app.categories SET post_type = 'link' WHERE NOT needs_zip;
INSERT INTO app.categories (slug, label, sort_order, needs_zip, post_type) VALUES ('expert', '전문가', 11, false, 'lens');

ALTER TABLE app.skills
  ADD COLUMN person text NOT NULL DEFAULT '',  -- 렌즈: 방법론의 출처 인물 (인물 연기 아님 — 출처 표기)
  ADD COLUMN basis text NOT NULL DEFAULT '',   -- 렌즈: "김난도의 소비트렌드 분석 방법론" 처럼 기반 방법론
  ADD COLUMN bands text NOT NULL DEFAULT '';   -- 렌즈: 오퍼레이션 단계 이름 (쉼표 구분, 파일에서 추출)

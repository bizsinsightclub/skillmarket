-- 플러그인·MCP 같은 '링크형 글': zip 없이 설치 명령 + 공식 페이지 + 제작자(외부)로 소개한다.
-- 분류가 zip 을 받는지 여부는 데이터로 둔다(코드에 분류 하드코딩 금지).
ALTER TABLE app.categories ADD COLUMN needs_zip boolean NOT NULL DEFAULT true;
UPDATE app.categories SET sort_order = 99 WHERE slug = 'etc';
INSERT INTO app.categories (slug, label, sort_order, needs_zip) VALUES
  ('plugin', '플러그인', 9, false),
  ('mcp', 'MCP 서버', 10, false);

ALTER TABLE app.skills
  ADD COLUMN maker text NOT NULL DEFAULT '',         -- 링크형: 만든 곳(외부 제작자). 크레딧의 '원작자' 칸은 추천인
  ADD COLUMN install_cmd text NOT NULL DEFAULT '',   -- 링크형: 설치 명령
  ADD COLUMN homepage_url text NOT NULL DEFAULT '';  -- 링크형: 공식 페이지 (http/https 만)

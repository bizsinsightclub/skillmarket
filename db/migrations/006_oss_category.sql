-- 플러그인·MCP 탭에 '오픈소스'(플러그인·MCP 서버가 아닌 추천 저장소: 앱·DB·커리큘럼 등) 분류 추가
UPDATE app.categories SET sort_order = 12 WHERE slug = 'expert';
INSERT INTO app.categories (slug, label, sort_order, needs_zip, post_type) VALUES ('oss', '오픈소스', 11, false, 'link');

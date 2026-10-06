-- 네 번째 글 종류 'app': HTML 파일 하나가 결과물인 글(대시보드·도구 등). 상세에서 격리된 화면으로 바로 실행해 본다.
ALTER TABLE app.categories DROP CONSTRAINT categories_post_type_check;
ALTER TABLE app.categories ADD CONSTRAINT categories_post_type_check CHECK (post_type IN ('skill', 'link', 'lens', 'app'));
INSERT INTO app.categories (slug, label, sort_order, needs_zip, post_type) VALUES
  ('dashboard', '대시보드', 13, false, 'app'),
  ('webtool', '도구', 14, false, 'app');

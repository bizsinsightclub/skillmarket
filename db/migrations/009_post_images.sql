-- 게시판 본문에 넣은 이미지. /files 라우트는 여기 등록된 경로만 서빙한다(로그인한 사람 누구나 — 게시판은 전사 공개)
CREATE TABLE app.post_images (
  path         text PRIMARY KEY,   -- board/<uuid>.<ext>
  uploader_id  int NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

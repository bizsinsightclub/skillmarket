-- 커뮤니티: 댓글(스킬 글·게시판 글 공통) + 대댓글 한 단계 + 공감, AI Breakthrough 게시판
SET LOCAL search_path TO app;

-- AI Breakthrough 게시판 글
CREATE TABLE posts (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id   int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       text NOT NULL,
  body_md     text NOT NULL DEFAULT '',
  link_url    text NOT NULL DEFAULT '',        -- 참고 링크(선택, http/https 만)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE post_reactions (                   -- 게시판 글 공감(사용자당 1회 토글)
  user_id     int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id     int NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- 댓글은 스킬 글이나 게시판 글 중 정확히 하나에 단다. 대댓글은 한 단계(parent_id = 최상위 댓글).
-- 지울 때 답글이 달려 있으면 자리만 남긴다(deleted = true, body 비움).
CREATE TABLE comments (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id    int REFERENCES skills (id) ON DELETE CASCADE,
  post_id     int REFERENCES posts (id) ON DELETE CASCADE,
  parent_id   int REFERENCES comments (id) ON DELETE CASCADE,
  author_id   int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body        text NOT NULL,
  deleted     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((skill_id IS NULL) <> (post_id IS NULL))
);
CREATE INDEX comments_skill ON comments (skill_id, id);
CREATE INDEX comments_post ON comments (post_id, id);
CREATE INDEX comments_parent ON comments (parent_id);

CREATE TABLE comment_reactions (                -- 댓글 공감(사용자당 1회 토글)
  user_id     int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  comment_id  int NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

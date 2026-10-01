-- 모든 테이블은 app 스키마. Supabase Data API 는 public 만 노출하므로 공개 키(anon/publishable)로는 접근 불가.
-- 서버만 POSTGRES_URL 로 직접 접속한다.
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
SET LOCAL search_path TO app;

CREATE TABLE users (
  id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          text NOT NULL UNIQUE,          -- 소문자, 인증된 사내 메일
  name           text NOT NULL DEFAULT '',
  department     text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

CREATE TABLE login_codes (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        text NOT NULL,
  code_hash    text NOT NULL,
  expires_at   double precision NOT NULL,      -- epoch ms
  attempts     int NOT NULL DEFAULT 0,
  consumed_at  double precision,
  created_at   double precision NOT NULL       -- epoch ms
);
CREATE INDEX login_codes_email ON login_codes (email, created_at);

CREATE TABLE categories (
  slug        text PRIMARY KEY,
  label       text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);
INSERT INTO categories (slug, label, sort_order) VALUES
  ('doc', '문서', 1), ('slides', '슬라이드', 2), ('web', '웹', 3), ('image', '이미지', 4),
  ('video', '영상', 5), ('data', '데이터', 6), ('dev', '개발', 7), ('etc', '기타', 8);

CREATE TABLE skills (
  id                 int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- 삭제된 id 재사용 없음 (저장소 폴더명)
  slug               text NOT NULL UNIQUE,
  name               text NOT NULL,
  summary            text NOT NULL DEFAULT '',
  body_md            text NOT NULL DEFAULT '',
  category           text NOT NULL DEFAULT 'etc' REFERENCES categories (slug),
  tags               text NOT NULL DEFAULT '',   -- 쉼표 구분
  author_name        text NOT NULL,
  author_email       text NOT NULL,
  owner_id           int NOT NULL REFERENCES users (id),
  based_on_skill_id  int REFERENCES skills (id) ON DELETE SET NULL,
  visibility         text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'restricted')),
  curation_status    text NOT NULL DEFAULT 'none' CHECK (curation_status IN ('none', 'pending', 'approved', 'rejected')),
  curated_version_id int,                     -- FK 는 skill_versions 생성 후 추가
  editor_pick        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skills_author_email ON skills (author_email);

CREATE TABLE skill_versions (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id     int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  version      text NOT NULL,
  zip_path     text NOT NULL,
  skill_md     text NOT NULL,
  uploaded_by  int NOT NULL REFERENCES users (id),
  changelog    text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, version)
);
ALTER TABLE skills ADD FOREIGN KEY (curated_version_id) REFERENCES skill_versions (id) ON DELETE SET NULL;

CREATE TABLE curation_reviews (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id     int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  version_id   int NOT NULL REFERENCES skill_versions (id) ON DELETE CASCADE,
  editor_id    int NOT NULL REFERENCES users (id),
  decision     text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skill_access (
  skill_id  int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  email     text NOT NULL,                     -- 소문자. 미가입자여도 됨
  PRIMARY KEY (skill_id, email)
);

CREATE TABLE snapshots (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id    int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('image', 'demo')),
  path        text NOT NULL UNIQUE,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE likes (
  user_id     int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  skill_id    int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);
CREATE INDEX likes_skill ON likes (skill_id, created_at);

CREATE TABLE installs (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id    int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  version_id  int NOT NULL REFERENCES skill_versions (id) ON DELETE CASCADE,
  user_id     int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX installs_skill ON installs (skill_id, created_at);

-- 참여 선순환(2026-10-12): 검수 필수 · 에디터 픽 분리 · 써봤어요 · 원작자 확인·변경 이력 · 출처 신고 · 등록 동의 · 월간 메일
SET LOCAL search_path TO app;

-- 에디터 픽을 승인에서 분리한다. 승인(curated_version_id) = 전사 공개 허용, 에디터 픽(picked_at) = 승인된 글 중 에디터가 따로 고른 것.
ALTER TABLE skills ADD COLUMN picked_at timestamptz;
-- 지금까지는 승인 = 에디터 픽이었으므로 기존 승인 글은 그대로 에디터 픽(선정 시각 = 그 버전을 승인한 시각)
UPDATE skills s SET picked_at = COALESCE(
  (SELECT MAX(r.created_at) FROM curation_reviews r WHERE r.skill_id = s.id AND r.version_id = s.curated_version_id AND r.decision = 'approved'),
  s.updated_at)
WHERE s.curated_version_id IS NOT NULL;
ALTER TABLE skills DROP COLUMN editor_pick;

-- 검수 필수 전환: 승인 없이 전사 공개돼 있던 기존 글(링크형 제외)은 최신 버전으로 일괄 승인한다(에디터 픽은 아님).
-- 검수 기록(curation_reviews)은 남기지 않는다 — 일괄 전환이라 검토한 에디터가 없다.
UPDATE skills s SET
  curated_version_id = (SELECT MAX(v.id) FROM skill_versions v WHERE v.skill_id = s.id),
  curation_status = CASE WHEN s.curation_status = 'pending' THEN 'pending' ELSE 'approved' END
FROM categories c
WHERE c.slug = s.category AND c.post_type <> 'link' AND s.visibility = 'public' AND s.curated_version_id IS NULL;

-- 승인 취소 시각: 이보다 먼저 받은 승인은 무효(취소된 옛 버전을 ?v= 로 다시 받지 못하게)
ALTER TABLE skills ADD COLUMN revoked_at timestamptz;

-- 원작자 확인: NULL = 확인 대기, true = 원작자 본인이 확인(또는 본인이 올림), false = 본인이 아니라고 함(출처 신고로 넘어감)
-- 링크형의 크레딧은 '추천인'이라 확인 절차가 없다(항상 true).
ALTER TABLE skills ADD COLUMN author_confirmed boolean;
UPDATE skills s SET author_confirmed = true FROM users u WHERE u.id = s.owner_id AND u.email = s.author_email;
UPDATE skills s SET author_confirmed = true FROM categories c WHERE c.slug = s.category AND c.post_type = 'link';

-- 등록 동의 시각(이 기능 전에 올린 글은 NULL)
ALTER TABLE skills ADD COLUMN agreed_at timestamptz;

-- 원작자 변경 이력: 바꿀 수는 있지만(오기재 정정) 바뀐 기록은 남는다. 첫 줄 = 등록 때 원작자.
CREATE TABLE author_history (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id      int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  author_name   text NOT NULL,
  author_email  text NOT NULL,
  changed_by    int NOT NULL REFERENCES users (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX author_history_skill ON author_history (skill_id, id);
CREATE INDEX author_history_email ON author_history (author_email, created_at);
INSERT INTO author_history (skill_id, author_name, author_email, changed_by, created_at)
  SELECT id, author_name, author_email, owner_id, created_at FROM skills;

-- 써봤어요: 사용자당 글 1회 토글. 다운로드 수와 달리 '실제로 써 봤다'는 신호.
CREATE TABLE uses (
  user_id     int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  skill_id    int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);
CREATE INDEX uses_skill ON uses (skill_id, created_at);

-- 출처 신고: 에디터가 검수 대기함에서 처리. 한 사람이 한 글에 열린 신고는 하나만.
CREATE TABLE reports (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  skill_id     int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  reporter_id  int NOT NULL REFERENCES users (id),
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  int REFERENCES users (id),
  resolution   text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX reports_one_open ON reports (skill_id, reporter_id) WHERE resolved_at IS NULL;

-- 알림 메일 발송 기록(원작자 확인 메일 한도용). 글을 지워도 남아야 하므로 skills 를 참조하지 않는다.
CREATE TABLE mail_log (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_log_recent ON mail_log (kind, created_at);

-- 월간 기여 메일: 같은 달에 두 번 보내지 않게(Cron 이 다시 불려도)
CREATE TABLE digest_sent (
  month    text NOT NULL,   -- 'YYYY-MM' (KST)
  email    text NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, email)
);

CREATE INDEX installs_user ON installs (user_id, skill_id);

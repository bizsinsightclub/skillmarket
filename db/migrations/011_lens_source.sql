-- The Lens 저장소 자동 등록(/api/lens-sync): 이 글이 The Lens 의 어느 렌즈인지(EXPERT-09 등).
-- 사람이 손으로 올린 렌즈 글은 NULL. 자동 등록이 같은 렌즈를 다시 보내면 이 값으로 같은 글을 찾아 새 버전만 올린다.
ALTER TABLE app.skills ADD COLUMN lens_source text;
CREATE UNIQUE INDEX skills_lens_source_key ON app.skills (lens_source) WHERE lens_source IS NOT NULL;

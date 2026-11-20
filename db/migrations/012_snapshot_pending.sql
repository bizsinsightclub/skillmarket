SET LOCAL search_path TO app;

-- 데모(결과물 미리보기 HTML)는 스크립트가 돈다 → 승인된 글이라도 에디터가 아닌 사람이 바꾸면
-- 그 데모는 재승인 전까지 남에게 안 보이게(pending). 이미지는 실행되지 않아 대상 아님(썸네일이 사라지면 안 됨).
-- 승인(review)하면 그 글의 pending 데모가 풀린다.
ALTER TABLE snapshots ADD COLUMN pending boolean NOT NULL DEFAULT false;

-- 브리핑에서 한 번 처리한 저장소 주소. 글을 지워도 남는다 → 다음 브리핑에 또 나와도 다시 올리지 않는다
CREATE TABLE app.briefing_seen (
  url        text PRIMARY KEY,  -- 소문자 https://github.com/owner/repo
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 지금까지 브리핑으로 올린 글(GitHub 트렌딩 태그)과, 이미 처리된 2026-10-06 브리핑 항목
INSERT INTO app.briefing_seen (url)
SELECT lower(rtrim(homepage_url, '/')) FROM app.skills WHERE homepage_url LIKE 'https://github.com/%'
ON CONFLICT DO NOTHING;
INSERT INTO app.briefing_seen (url) VALUES
  ('https://github.com/tamaratran/fast-jev-compaction'),
  ('https://github.com/qingyuna/answer-me-with-html'),
  ('https://github.com/mikehasa/golive-skill')
ON CONFLICT DO NOTHING;

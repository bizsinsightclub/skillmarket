SET LOCAL search_path TO app;

-- 플러그인·오픈소스(링크형) 분야 폴더. 종류(plugin/mcp/oss)와 별개로 '무슨 일에 쓰나'로 나눈다.
-- 값은 lib/topics.ts 의 슬러그(doc·slides·data·design·dev·automation·etc). Haiku 가 업로드 때 매기고, 기존 글은 백필. NULL = 미분류(기타로 묶임).
ALTER TABLE skills ADD COLUMN topic text;

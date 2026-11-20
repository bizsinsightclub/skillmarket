SET LOCAL search_path TO app;

-- 의미 검색용 임베딩 벡터. pgvector 대신 real[] (코퍼스가 작아 전수 코사인으로 충분, 테스트 PGlite 에도 그대로 돈다).
-- 수천 개로 커지면 pgvector + hnsw 인덱스로. 값은 lib/embeddings.ts(Voyage)가 채운다.
ALTER TABLE skills ADD COLUMN embedding real[];

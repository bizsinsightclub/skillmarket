SET LOCAL search_path TO app;

-- 핵심 한 줄: 검수 대기함 카드에서 호버 없이 '무엇인지' 바로 보이게. Haiku 가 이름+요약(+AI 소개)으로 35자 안팎(lib/describe.ts).
-- NULL = 아직(저장 때·enrich 크론이 채움).
ALTER TABLE skills ADD COLUMN gist text;

-- NVIDIA skillspector 검사 결과. 에디터 PC 에서 scripts/scan-skills.ts 로 돌려 기록(서버는 Node 라 Python 도구를 못 돌림).
-- 승인이 버전에 고정되므로 버전별. 링크형은 '등록본' 버전에 저장소를 검사한 결과(저장소는 이후 바뀔 수 있음).
CREATE TABLE skill_scans (
  version_id     int PRIMARY KEY REFERENCES skill_versions (id) ON DELETE CASCADE,
  score          int NOT NULL,                 -- 0~100 (ERROR 면 -1)
  recommendation text NOT NULL,                -- SAFE | CAUTION | DO_NOT_INSTALL | ERROR
  findings       jsonb NOT NULL DEFAULT '[]',  -- 상위 발견 요약 [{id, category, severity, file, line}]
  tool_version   text NOT NULL DEFAULT '',
  scanned_at     timestamptz NOT NULL DEFAULT now()
);

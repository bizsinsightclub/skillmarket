@AGENTS.md

# skillmarket — 사내 Claude 스킬 마켓플레이스

사내 구성원이 만든 Claude 스킬(`SKILL.md` 폴더)을 올리고, 찾고, 설치하는 웹서비스. Vercel 공개 호스팅(https://skillmarket-beta.vercel.app), 가입은 사내 메일만.
기능 레퍼런스: https://skillry.dev (트렌딩/인기 정렬 · 결과물 미리보기 · 설치 수). 결제·구독 기능은 **가져오지 않는다**.
화면은 **skillry 형 카드 그리드**: 결과물 썸네일(16:10)이 주인공, 이미지 없는 스킬은 이름·분류로 자동 표지(`Cover`). 글래스모피즘(고정 메쉬 그라디언트 위 `glass`·`glass-dark`·`panel` 유틸) + Pretendard Variable + 라임 강조(`accent`). **디자인을 고칠 때는 `design/DESIGN.md` 의 원칙을 먼저 읽는다.**

## 화면

- `/` 홈 — 소개 한 줄 + **에디터 픽 조명**(`components/pick-spotlight.tsx`, 최근 선정 순, 6초마다 회전, 호버·포커스·탭 숨김·동작 줄이기 설정 시 정지) + 섹션: 요즘 뜨는 스킬(최근 7일 활동 있는 것만) · 이달의 기여자 · 새로 올라온 스킬 · 전문가 렌즈 · 추천 플러그인·MCP. (AI Breakthrough 는 홈에 넣지 않는다 — 메뉴로만, 2026-10-06) 검색은 헤더 하나만.
- `/skills` 스킬 · `/plugins` 플러그인·MCP · `/experts` 전문가 렌즈 · `/picks` 에디터 픽 — 모두 `components/catalog.tsx`. 탭(전체/에디터 픽), 그 종류의 분류 칩, 정렬(최신·트렌딩·인기, `/picks` 는 최근 선정), 검색(`?q=`, 헤더 검색창은 `/skills`), 카드 그리드, 페이지네이션(20개). 스킬과 플러그인·MCP 는 목록에서 섞지 않는다(`listBoard` 의 `kind`).
  - 카드: 썸네일 위 왼쪽 배지(에디터 픽/비공개/검수 대기 — 검수 대기는 올린 사람·원작자·에디터 목록에만), 오른쪽 아래 설치·좋아요 수, 아래 이름·분류·요약·원작자.
- `/skills/[slug]` 상세 — 왼쪽 결과물 이미지·데모(크게), 오른쪽 고정 패널(배지, 이름+버전, 좋아요, 설치 명령 복사·ZIP 받기, 크레딧, 태그, 수정), 아래 설명·설치 방법·SKILL.md·큐레이션·버전 이력·파생 스킬.
- `/write` 글쓰기(업로드) · `/skills/[slug]/edit` 수정 · `/skills/[slug]/versions/new` 새 버전.
- `/hall` 명예의 전당(최근 30일·전체) · `/write/template` SKILL.md 양식 zip
- `/u/[email]` 원작자 페이지(합계 + 카드, **만든 글 / 추천한 글** 탭 — 추천한 외부 플러그인·MCP·오픈소스를 만든 것처럼 보이지 않게, 합계도 만든 글만) · `/me` 내 정보(프로필 + **내 기여** 대시보드: 공개된 내 글·받아 간 사람·이번 달·써봤어요·받은 좋아요, 내 글별 상태·수치) · `/login` 로그인 · `/editor` 검수 대기함(헤더 배지 = 대기 건수. **인덱스 카드** — 호버 없이 신규/재검수·분류·안전검사 배지·이름·**핵심 한 줄(gist)**·올린 사람이 바로 보이고, 긴 요약·README 요약·검사 발견은 카드의 '자세히'. 카드마다 승인·반려(사유)·삭제, 체크해서 한꺼번에 승인·삭제 — 승인은 목록에 보인 최신 버전으로 고정) · `/inbox` 알림함(내 글의 검수 결과·남의 좋아요·남의 댓글, 내 댓글에 달린 남의 답글. 별도 테이블 없이 기존 기록에서 조회, `users.inbox_seen_at` 이후 = 안 읽음).
- `/board` **AI Breakthrough** 게시판(앰버 색) · `/board/new` 글쓰기 · `/board/[id]` 글(마크다운 본문 + 본문 이미지 + 참고 링크 + 공감 + 댓글) · `/board/[id]/edit`. 글쓴이·에디터만 수정·삭제.
  - 본문 이미지: 버튼·붙여넣기·끌어다 놓기 → 브라우저가 tmp 에 직접 올림 → `attachBoardImage` 가 바이트로 판별(png/jpg/webp/gif, 장당 5MB)해 `board/<uuid>` 로 옮기고 `post_images` 에 등록 → 커서 자리에 `![](/files/board/…)`. `/files` 는 등록된 board 경로만, 로그인한 사람 누구나. ponytail: 저장 안 한 글·지운 글의 이미지는 남는다(정리 미구현).
- **썸네일**: 이미지를 올리지 않으면 `/skills/[slug]/cover`(next/og)가 입력한 정보(종류·이름·요약·만든 곳/기반·태그)로 그린다. `?v=updated_at` 캐시 키. 폰트는 Pretendard otf(`next.config.ts` 의 outputFileTracingIncludes). **숫자(스킬 n개 등) 넣지 않는다.**

## 검수 필수 · 에디터 픽 (2026-10-12 — 승인과 에디터 픽을 다시 분리)

- **검수 필수**: 전사 공개(`public`) 글은 링크형(플러그인·MCP·오픈소스)을 빼고 **승인(`curated_version_id`)돼야 남에게 보인다**. 올린 사람·원작자(`author_email`)·에디터는 승인 전에도 본다. 지정 공개(`restricted`)는 검수 없이 지정한 사람에게 보인다. 규칙은 `lib/queries.ts` 의 `visible()` 하나.
- 새 글·새 버전·전사 공개 전환 때 자동으로 검수 대기(`autoRequest`). 승인은 에디터가 본 `version_id` 로 고정 → 새 버전은 승인 전까지 남에게 안 보이고, 남은 **승인된 버전만** 받고 실행한다(`onlyApproved`·`pickVersion` — `?v=` 로 승인 전 버전을 달라고 해도 404). 예전에 승인된 버전은 계속 받을 수 있다.
- 승인 뒤 에디터가 아닌 사람이 이름·요약·설명·태그·이미지·데모를 바꾸면 다시 검수 대기(`requeue`). ponytail: 고친 내용은 바로 보인다(오타 하나에 글이 숨지 않게) — 에디터가 대기함에서 보고 문제면 승인 취소. 저장만 누르면 그대로.
- 승인 취소(또는 공개 중인 그 버전을 반려)하면 `revoked_at` 이 찍혀 그 전에 받은 승인은 모두 무효 → 옛 버전을 `?v=` 로 다시 받지 못한다.
- 에디터가 검토하는 사이 새 버전이 올라오면 승인 뒤에도 대기함에 남는다.
- 검수 필수 전환(2026-10-12) 때 승인 없이 공개돼 있던 기존 글은 최신 버전으로 일괄 승인(검수 기록 없음, 마이그레이션 011).
- **에디터 픽 = 승인된 글 중 에디터가 따로 고른 것**(`picked_at`). "승인 취소"(`revoke`)는 승인·픽을 함께 내린다(검수 필수 글은 다시 숨는다).
- 링크형은 설치 명령·공식 페이지가 버전 파일 대신 → 에디터가 아닌 사람이 이걸 바꾸면 승인·픽이 내려간다(링크형은 그래도 보인다).
- `curation_status` 는 마지막 검수 요청의 상태일 뿐(재검수 대기·반려 중에도 이전 승인 버전은 공개 유지).
- 홈 조명·`/picks` 는 **최근 선정 순**(`sort=picked`, `picked_at`). 비공개 글은 에디터 픽 목록에 나오지 않는다.

## 참여 선순환 (2026-10-12)

공유 → 크레딧 → 재사용 → 인정 순으로 바퀴가 돌게. 공식화(인사 평가 연동)는 미정 → 지금은 **인정**(숫자·알림·명예의 전당)만.

- **설치 수 = 받아 간 사람 수**: 사람당 한 번, 올린 사람·원작자 본인은 빼고 센다(`installers()`). `installs` 는 이벤트 로그 그대로. 기여 평가에 쓸 숫자라 다시 받기로 부풀릴 수 없게.
- **써봤어요**(`uses`): 사람당 1회 토글, 본인 것은 누를 수 없다. 실제 사용 신호(스킬은 각자 PC 에서 돌아 사이트가 사용을 알 수 없다).
- **원작자 확인**: 본인이 아닌 사람을 원작자로 적으면 `author_confirmed = NULL`(확인 대기) + 원작자에게 확인 메일(사내 메일만) + 알림함. 원작자가 "맞아요"→확인, "제가 아니에요"→출처 신고로 자동 접수. 원작자 이메일이 바뀌면 다시 확인 대기. 링크형의 추천인은 확인 절차 없음.
  - 메일 한도(`mail_log`, 글을 지워도 남는다): 같은 사람 하루 3통, 전체 하루 30통. 넘으면 알림함으로만. Gmail 하루 약 500통 = 로그인 400 + 원작자 확인 30 + 월간 메일 60.
- **원작자 변경 이력**(`author_history`): 바꿀 수는 있되(오기재 정정) 기록은 남고 상세에 보인다. 관리자도 저자를 못 바꾸게 하는 건 하지 않는다(DB 주인은 늘 바꿀 수 있고, 정정이 막히면 안 됨).
- **출처 신고**(`reports`): 상세 하단에서 사유와 함께. 한 사람이 한 글에 열린 신고는 하나(부분 고유 인덱스). 에디터가 검수 대기함에서 처리 내용을 적어 닫으면 신고자 알림함으로.
- **민감정보 검사**(`lib/sensitive.ts`): 업로드·수정·새 버전 때 입력한 글 + 파일 텍스트(zip 안 텍스트 파일 — UTF-8·UTF-16·EUC-KR, docx·pptx·xlsx 속 글자, 렌즈, HTML, 데모)에서 주민번호·휴대전화·API 키·개인 키·JWT·대외비 표시·`SENSITIVE_TERMS`(광고주명 등, 쉼표 구분 환경변수 — 영문은 단어 단위라 SK 가 SKILL 에 걸리지 않는다)를 찾으면 막는다. 에디터는 건너뛴다(잘못 걸린 글을 대신 올리게). 이미지·PDF 속 글자는 못 본다 → 에디터 검수. 이 사이트는 외부 클라우드라 **광고주·고객 정보는 태그로 가리지 않고 아예 받지 않는다**.
- **등록 동의**: 올리기 화면 체크박스(서버가 다시 확인), `skills.agreed_at`. 문구는 "사내 구성원이 업무에 쓰고 고칠 수 있게 공유 · 원작자 이름과 이력은 기록 · 광고주·고객 정보·개인정보·키 없음". 공식화 전이라 '회사 귀속'은 넣지 않는다.
- **기여 집계**(내 정보 '내 기여'·`/hall` 명예의 전당·월간 메일): 전사 공개·승인된 글만(모두에게 같은 숫자), 링크형·외부 제작물 제외(추천이지 만든 것이 아님), 원작자가 부인한 글 제외. 순위 숫자는 붙이지 않는다.
- **알림함**: 받아 감(사람·글당 한 번)·써봤어요·에디터 픽은 올린 사람과 원작자 모두에게, 원작자 확인 요청은 원작자에게, 신고 처리 결과는 신고자에게.
- **월간 기여 메일**: Vercel Cron 매달 1~7일 09:00 KST → `/api/cron/monthly`(CRON_SECRET). 지난달 활동이 있는 사내 원작자에게만, 하루 60통씩 나눠서. 한 사람씩 `digest_sent(month, email)` 로 잡고 보내고, 실패하면 풀어 다음 날 다시 → 같은 달 한 번.
- **SKILL.md 양식**: `/write/template` 가 `my-skill/SKILL.md` 양식 zip 을 준다(올리기 화면 zip 칸 옆 링크).
- 미구현(요청 시): 부서별 현황(부서 칸이 자유 입력이라 집계 불가 → 고정 목록 필요), 공개 예약(embargo), 인사 연동.

### 의미 검색 (2026-11-20)

검색은 **의미(임베딩) + 키워드 폴백**. "슬라이드에 좋은 거"처럼 단어가 글에 없어도 뜻으로 찾는다.
- 임베딩 = **Voyage**(`lib/embeddings.ts`, `voyage-3.5` 1024차원). Anthropic 은 임베딩 API 가 없어 Voyage(Anthropic 공식 추천). 분류·트리아지용 LLM 은 별개(Anthropic Haiku 예정).
- `VOYAGE_API_KEY` 없으면 임베딩이 null → **기존 키워드(ILIKE) 검색으로 자동 폴백**(키 없이 배포해도 안전). 검색어가 있을 때 `components/catalog.tsx` 가 쿼리를 임베딩해 `listBoard({ queryEmbedding })` 로 넘긴다.
- 벡터는 `skills.embedding real[]` 에 저장(pgvector 안 씀 — PGlite 테스트 호환·코퍼스 작음). `listBoard` 가 후보 전수 코사인으로 정렬, 유사도 `SEM_FLOOR(0.35)` 미만은 제외, 관련 결과 없으면 키워드 폴백. **ponytail: 수천 개로 커지면 pgvector + hnsw 로.**
- 업로드·수정 때 `reembed`(이름+요약+설명)로 저장(외부 API, 커밋 뒤·실패해도 저장은 그대로). **아침 브리핑처럼 다른 경로로 들어온 글**은 정기 크론 `/api/cron/enrich`(**매일 04:00 UTC=13:00 KST** — 오전 브리핑·승인분까지, 2026-11-20 사용자 요청)가 순서대로 채운다: ①임베딩 NULL(Voyage 16개씩·3RPM 배려) ②분야 NULL(Haiku 30개씩) ③링크형 README 소개 ④핵심 한 줄 ⑤GitHub 스타(오래된 것부터 40개) ⑥**승인된 스킬의 구조도**(archify, 남은 시간 동안). 즉 유사도 지도·구조도는 자동으로 최신 유지. 못 끝낸 건 NULL 로 남아 다음 날.
- ponytail: 링크형 안전검사(skillspector)는 같은 '올릴 때 AI 보강' 훅을 공유 — 다음 차례.

### AI 추천 챗봇 (2026-11-20)

"원하는 스킬 찾아주는" 추천 도우미(`/ask`, 우측 하단 플로팅 버튼 `components/ask-widget.tsx`(로그인 시 모든 화면 고정, 누르면 그 자리에 대화창 팝업), `components/ask-chat.tsx`). **추천만** — 실행·설치는 안 하고 링크만.
- `lib/ask.ts`: 질문을 임베딩해 `listBoard` 의미검색 top-8(가시성 필터 그대로) → 그 **후보 메타(이름·요약)만** Haiku(`claude-haiku-5-5`)에 넘겨 왜 맞는지 한국어로 설명. 링크·카드는 코드가 슬러그로 만든다 → 모델이 스킬·URL 을 지어낼 수 없음(환각 차단). `/api/ask` 가 로그인·입력 모양 검사.
- `ANTHROPIC_API_KEY`(콘솔 크레딧) 없으면 설명은 null → 화면은 **카드(의미 검색 결과)만**(키 없이 배포해도 안전). Haiku 호출은 fetch(새 의존성 없음), thinking 끄고 effort low.

### 플러그인 분야 폴더 (2026-11-20)

플러그인·MCP 는 수가 압도적(링크형 ~109개, 대부분 오픈소스 한 바구니)이라 **분야 폴더**로 먼저 나눈다. 종류(plugin/mcp/oss = `category`)와 별개의 축.
- 분야 = `skills.topic`(`lib/topics.ts` 의 `PLUGIN_TOPICS`: 문서·글쓰기/슬라이드·발표/데이터·분석/디자인·이미지/개발/자동화·업무/기타). **Haiku 가 이름+요약으로 분야 1개 배정**(업로드·수정 때 `retopic`, 링크형만, 실패·키없으면 'etc'). 기존 글은 1회성 백필(배치 30).
- `/plugins`: 뷰 모드 토글 **폴더 | 유사도 지도**(`?view=map`). 폴더 = **분야 그리드**(`pluginTopicCounts`), 폴더 클릭 → `/plugins?topic=dev` = 그 분야 리스트(기존 `Catalog`, topic 필터) + "← 분야 전체". `listBoard({ topic })`, etc 는 미분류(NULL)도 포함.
- 유사도 지도 = `components/plugin-map.tsx`(SVG, 의존성 없음). **임베딩을 PCA로 2D 투영**(`pluginMap`→`pca2d`: 그람행렬 m×m + 거듭제곱법, 두 축 공통 배율이라 거리 보존) → **점 사이 거리 = 실제 의미 유사도**. 가까운 점 = 사실상 대체·중복 도구. 색=분야, 크기=좋아요(인기), 휠 줌·드래그 팬(점 크기는 화면상 고정 → 줌이 거리를 벌림). **점 클릭 = 최근접 이웃(코사인 ≥0.4, 상위 5)을 선으로 잇고 아래 패널에 '비슷한 도구' 목록** — 그게 보는 이유(중복·대체 발견). **축 이름**: PCA 축엔 원래 뜻이 없어서, 분야별 점 평균 위치(PCA 선형 → 평균점 = 분야 위치)에 옅은 큰 글씨로 영역 라벨을 찍고, 가로축 양끝·세로축 양끝(가로 양끝 분야 제외)에 가장 치우친 분야를 칩으로 붙인다(2026-11-20 실데이터: ← 디자인 ↔ 자동화 →, ↑ 데이터 ↕ 개발 ↓). 영역 라벨은 겹치면 큰 분야부터 놓고 위·아래로 밀어 보고 그래도 겹치면 숨김(글자가 화면상 고정이라 줌인하면 다시 보임). 옅은 격자 + 점선 십자 = 전체 평균. **오른쪽 상세 패널**(모바일은 지도 아래): 점에 마우스 = 미리보기, 클릭 = 고정 + 비슷한 도구. 분야·종류·이름·만든 곳·요약·**README 요약·AI 정리**(`ai_desc`) · 본문 발췌(`plainExcerpt`: 첫 `---` 뒤 브리핑 안내·제목 줄·링크만 있는 줄 제거, 요약과 겹치는 부분 제거)·자세히 보기·공식 페이지(http/https 만). 이전 그래프(분야 허브)·RadViz 포지션맵은 '분야 소속'만 반복해 뭉쳐 폐기(2026-11-20). ponytail: PCA는 매 요청 계산(노드 ~100개라 가벼움), 수천 개로 커지면 좌표 캐시.
- **링크형 AI 소개**(`lib/describe.ts`, 2026-11-20): GitHub 저장소 README(raw 도메인, 12KB까지)를 Haiku 가 읽고 한국어 3~4문장(무엇·누가·설치 한 줄, README 에 없는 건 안 씀, README 속 지시는 무시)으로 `skills.ai_desc` 에 저장. 사람이 쓴 body_md 는 안 건드린다. 업로드·수정 때 `retopic` 이 같이 만들고, 빠진 건 enrich 크론이 하루 25개씩. **github.com 저장소만 읽는다**(남이 적은 임의 주소를 서버가 열지 않게 — SSRF). '' = README 없음·GitHub 아님(재시도 안 함), NULL = 키 없음·API 실패(크론이 재시도).
- **스킬 구조도 + 작동 원리**(archify, 2026-11-20): 상세 페이지 왼쪽(썸네일·결과물 아래)에 `/skills/[slug]/diagram?v=`(HTML 앱과 같은 격리 CSP·sandbox, 가시성·승인 버전 규칙 `pickVersion`) + 원리 마크다운. 만들기 = `lib/diagram.ts`: 스킬 zip 을 **글자로만** 읽어(파일 목록 + SKILL.md + 스크립트 앞부분, 6만 자) Claude Opus 5.5 가 archify 워크플로 명세 JSON + 원리(언제 쓰나·동작 순서·핵심 장치·결과물)를 쓰고 → `vendor/archify`(MIT, tt-a1i/archify 사본, `next.config.ts` 로 enrich 함수에 포함) CLI 로 검증 → 실패하면 진단을 돌려줘 최대 3번 고침 → showcase 실패 시 standard 로 렌더 → **폰트는 Pretendard 로 통일**(`withPretendard`: 격리 iframe 이라 사이트 폰트를 못 불러오므로 Pretendard 분할 폰트 92조각 중 쓰인 글자가 든 조각만 base64 로 넣고 글꼴 지정을 전부 덮어씀, 약 +0.5MB) → Storage `skills/<id>/diagram/<version_id>-<시각>.html`(text/plain, 만들 때마다 새 경로 — 업로드는 덮어쓰기 안 됨, 옛 파일은 DB 갱신 뒤 삭제) + `skill_versions.diagram_path·principle`. 버전별(승인본 기준). '' = 실패(재시도 안 함). 자동: enrich 크론 ⑥, 수동: `npm run diagram`(`--force`). 명세는 AI 가 쓰지만 HTML 은 archify 렌더러가 만들고, 그래도 격리 iframe 으로만.
- **유사도 지도 크기 토글**: ♥ 좋아요 / ★ GitHub 스타(`skills.stars·stars_at`, enrich ⑤ 가 갱신, `GITHUB_TOKEN` 있으면 사용). 스타는 51~47만이라 **원 넓이 ∝ 스타**(반지름 ∝ √스타, 최댓값 14), 큰 원을 먼저 그려 작은 원이 위에.
- **핵심 한 줄**(`skills.gist`, 2026-11-20): 모든 종류의 글에 '무엇인지' 35자 안팎 한 줄(Haiku, 이름+요약+AI 소개, 30개씩 한 번에 `makeGists`). 저장 때 `regist`, 빠진 건 enrich 크론(검수 대기 먼저, 하루 90개, 링크형은 AI 소개가 생긴 뒤).
- **안전검사**(NVIDIA skillspector, A 방식 = 에디터 PC, 2026-11-20): 서버가 Node 라 Python 도구를 못 돌려 `npm run scan`(`scripts/scan-skills.ts`)을 에디터 PC 에서 돌린다 → 검수 대기 **스킬 zip**(Storage 에서 받아) 최신 버전을 `--no-llm` 정적 검사(링크형 저장소는 `--links` 로만 — 대부분 스킬이 아닌 앱 전체라 용량 한도·잡음, 실패는 기록 안 함, 링크형 카드엔 미검사 배지 안 붙임) → `skill_scans` 에 점수·권고(SAFE/CAUTION/DO_NOT_INSTALL/ERROR)·상위 발견 8개 → 검수 대기함 배지(미검사도 표시). `--all` 전체, `--force` 재검사. 준비: `uv tool install --python 3.13 git+https://github.com/NVIDIA/skillspector.git`. `--no-llm` 이라 파일 내용은 밖으로 안 나감(의존 패키지 이름만 OSV.dev). 렌즈·HTML 앱은 대상 아님. 한계: 한국어 지시문은 놓칠 수 있음(README 명시), 정적 검사라 노골적 유출 문구도 CAUTION 42 정도(시험). **2026-11-20 보정: 올라온 스킬 zip 4개 중 3개가 DO_NOT_INSTALL 인데 모두 정상 동작이 걸린 오탐**(research-pipeline: 공공 API 에 키를 보내는 스크립트 = TT3 CRITICAL, hyperslides: CSS 안 RA2·AE1, web-slide-deck: AE1 = '참조 파일을 다 못 봄'으로 악성 근거 아님 — 카드에 따로 표시) → **참고용, 막지 않는다**. 에디터는 발견 위치를 보고 판단. ponytail: 오탐률을 본 뒤 DO_NOT_INSTALL 은 사유 입력 후 승인(하드 게이트)으로, 자동화는 B(GitHub Actions)·C(Vercel Python).
- ponytail: 분야는 스킬 `category` 와 축이 다르므로 별도 컬럼. 종류 칩(plugin/mcp/oss)은 분야 안에서 2차 필터로 그대로.

## 바이브코딩 아침 브리핑 자동 등록 (2026-10-06)

- 매일 아침 mk.kansas@gmail.com 이 자기에게 보내는 "바이브코딩 아침 브리핑 - 날짜" 메일(GitHub 트렌딩 목록)을 **오픈소스 링크형 글 + 검수 대기(pending)** 로 올린다 → 에디터가 검수 대기함에서 설치 방법을 보태고 승인.
- Vercel Cron(`vercel.json`, 매일 01:00 UTC = 10:00 KST) → `/api/cron/briefing`. `proxy.ts` 로그인 검사에서 빠지고 `Authorization: Bearer CRON_SECRET` 로만 연다.
- 메일 읽기 `lib/briefing-mail.ts`: SMTP 와 같은 Gmail 앱 비밀번호로 IMAP, **보낸편지함에서만** 찾는다(최근 3일) — From 위조 메일로 글이 올라가지 않게. GitHub 주소(`https://github.com/owner/repo`)인 항목만.
- 해석·저장 `lib/briefing.ts`(테스트 있음): "N. 이름 — 덧말 / 주소 / 설명" 형식. 같은 저장소 주소(대소문자·끝 / 무시)나 같은 이름이 있으면 건너뛴다 → 몇 번을 돌려도 중복 없음. 처리한 저장소는 `briefing_seen` 에 남겨, 에디터가 지운 글이 다음 브리핑에 또 나와도 되살리지 않는다. 올린 사람·추천인 = `EDITOR_EMAILS` 첫 번째.
- README 기반 소개는 `skills.ai_desc`(아래 '링크형 AI 소개') — 사람이 쓰는 본문(body_md)은 그대로 두고, 설치 방법 보강·승인은 여전히 에디터.

## 댓글·공감 (2026-10-06)

- 스킬·플러그인·렌즈 글과 게시판 글 아래 같은 댓글 영역(`components/comments.tsx`). 평문(마크다운 아님), 2000자.
- 대댓글은 한 단계: 답글의 답글도 최상위 댓글 아래에 붙는다(`lib/community.ts` 의 `addComment`).
- 공감 = 사용자당 1회 토글(댓글·게시판 글). 스킬 글은 기존 좋아요를 그대로 쓴다.
- 삭제는 글쓴이·에디터. 답글이 달린 댓글은 "삭제된 댓글" 자리만 남는다.
- 비공개 스킬의 댓글: 쓰기·지우기·공감 모두 서버 액션이 `getSkill`(가시성)로 다시 확인한다 — 못 보는 사람은 404.

## 핵심 기능 (이 범위 밖은 요청 전까지 만들지 않는다)

0. **네 종류의 글** — 분류의 `categories.post_type`(skill·link·lens·app)이 정한다. 코드에 분류 이름을 하드코딩하지 않는다. (`needs_zip` 컬럼은 미사용 — 다음 정리 때 삭제)
   - 스킬(zip): 아래 1~6 전부.
   - **링크형(플러그인·MCP 서버·오픈소스)**: 오픈소스 = 플러그인·MCP 가 아닌 추천 저장소(앱·DB·커리큘럼 등). zip 없이 `install_cmd`(설치 명령) + `homepage_url`(http/https 만) + `maker`(만든 곳, 외부). 크레딧의 원작자 칸은 **추천인**. 다운로드·새 버전·SKILL.md 없음, 설치 수 표시 안 함.
   - 링크형도 큐레이션 모델을 그대로 쓰려고 `version='link'`, `zip_path=''` 인 '등록본' 버전 한 줄을 만든다(`lib/link-post.ts`). 수정해도 새 버전이 생기지 않는다.
   - **렌즈(전문가 탭 `/experts`)**: The Lens(`C:/pjt/magilite`)의 렌즈 `.md` 파일. 첫 펜스드 코드블록 = 시스템 프롬프트(magilite `extract_system_prompt` 와 같은 규칙), `# 역할`·`# 오퍼레이션`·`# 출력 형식` 필수(`lib/lens-file.ts`). `person`(기반 인물)·`basis`(기반 방법론) 입력, `bands`(오퍼레이션 단계)는 파일에서 추출. 버전 파일은 `.md` 로 저장·다운로드.
     - **The Lens 원칙을 따른다**: 실존 인물의 공개된 방법론을 기준으로 삼되 인물 연기 금지, 화면 표기는 '○○ 기반'(출처 표기). 초상 사진 이용 권한은 올리는 사람 책임.
     - The Lens 로 바로 설치하는 연동은 아직 없다(The Lens 에 파일 가져오기·마켓의 expert 종류 지원이 없음 — 2026-10-02 조사). 지금은 .md 다운로드·프롬프트 복사.
     - 헤더 = `[로고 · 메뉴 상자]` ··· `[검색 · 이름 · 내정보 · 알림함 · 검수대기함(에디터만) · 올리기]`. 메뉴 상자(`components/nav-menu.tsx`)는 메뉴마다 고유 색·아이콘(스킬 라임 · 플러그인 하늘 · 전문가 퍼플 · HTML 앱 에메랄드 · AI Breakthrough 앰버). 휴대폰에선 메뉴 상자가 둘째 줄(옆으로 밀기·가로 스크롤), 로고는 '스킬마켓' 글자만. md~xl(768~1279px)은 메뉴 아이콘만, 헤더 검색창은 1400px 부터(메뉴 5개라 그 아래선 한 줄에 안 들어감). (AI 추천은 메뉴가 아니라 우측 하단 플로팅 버튼 `components/ask-widget.tsx`(누르면 그 자리에 대화창 팝업), 로그인 시 모든 화면에 고정)
     - 전문가 탭의 '렌즈 올리기' 옆(소개 영역·목록 위)에 "시스템 사용 문의는 김민석 프로에게" 안내(`Catalog` 의 `note`). 이메일은 공개 저장소라 코드에 넣지 않는다. 에디터 픽은 홈 조명이 맡아 메뉴에 없다. 페이지가 `<span hidden data-tab="/experts">` 같은 표식을 그리면 `globals.css` 의 `body:has([data-tab=…])` 규칙이 그 메뉴를 꽉 찬 색으로(JS 없음).
     - **색으로 구분**: 전문가 탭·렌즈 카드·상세는 The Lens 브랜드 퍼플(`lens`·`lens-2`·`lens-deep`·`lens-bg`·`lens-ink` 토큰, magilite `static/theme.css` 값 그대로). 다른 탭은 라임(`accent`).
     - 상단 소개(`components/the-lens-intro.tsx`) + 소개 영상은 **공개 저장소에 넣지 않는다**(사내 초안) — Storage 비공개 버킷 `uploads/site/the-lens-intro.mp4`(+ `-poster.jpg`), `/media/[name]` 라우트가 로그인 확인 후 서명 URL 로 넘긴다. 교체는 Storage 파일만 덮어쓰기.
   - **HTML 앱(`/apps`, 에메랄드)**: 대시보드·도구처럼 HTML 파일 하나가 결과물(분류: 대시보드·도구). 버전 파일 `.html`(UTF-8, 4MB — 함수가 직접 응답하므로), `<title>` 이 이름 기본값(`lib/html-app.ts`).
     - 실행은 `/skills/[slug]/app`(?v=버전, 기본 = 에디터 픽 승인 버전 → 최신)만: 응답 헤더 `CSP: sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads; form-action 'none'`(`APP_CSP`) + 상세의 iframe 도 같은 sandbox. **allow-same-origin 절대 금지**. `form-action 'none'` 로 올린 앱이 폼을 바깥 서버로 제출하지 못하게(로그인 코드 피싱 폼 차단 — JS 로 처리하는 폼은 그대로). Storage 엔 text/plain 으로 저장.
     - 격리된 화면에선 localStorage 가 막혀 앱이 아예 죽으므로, 막혔을 때만 메모리 저장소로 바꿔 끼우는 짧은 스크립트를 `<head>` 뒤에 넣어 응답한다(`withStorageShim`, 새로고침하면 사라짐).
     - ponytail: 같은 사이트 출처라 앱끼리 저장소 공유·영구 저장은 없음. 필요해지면 별도 도메인 + 서명 토큰 주소로 옮겨 allow-same-origin 을 그 도메인에서만.
   - 수정할 때 글 종류(스킬·링크형·렌즈·HTML 앱) 사이로 분류를 바꿀 수 없다.

1. **업로드** — 스킬 폴더 zip. `SKILL.md` 는 zip 루트 또는 최상위 폴더 한 겹 안. frontmatter `name`·`description` 필수, 이름·요약 기본값으로 쓴다. `name` 은 Claude 스킬 규격(영문 소문자·숫자·하이픈 64자, anthropic·claude 금지), `description` 1024자 이내 — 어긋나면 Claude 앱 업로드가 거부되므로 올릴 때 막는다.
   - 서버는 zip 을 디스크에 풀지 않는다. 메모리에서 검사한 뒤 **다시 묶어서**(정규 파일만, SKILL.md 루트) 저장 → 심볼릭 링크·이상한 속성이 설치자에게 가지 않는다.
2. **원작자 크레딧**
   - 원작자 1명(`author_name` + `author_email`). 올린 사람 ≠ 원작자일 수 있어 따로 입력(기본값 = 내 정보). 원작자는 가입자가 아니어도 된다.
   - **외부에서 만든 스킬·HTML 앱**(웹에 공개된 Anthropic 공식 스킬 등): 올리기 화면 '누가 만들었나요? 외부' → `maker`(만든 곳) + `homepage_url`(출처 주소) 필수, 크레딧 칸은 **추천인**(원작자 확인 없음). 카드·표지 'by 만든 곳 · 추천 ○○', 상세 '만든 곳·출처·추천인'. 규칙: `maker` 가 비어 있지 않으면 = 남이 만든 것(링크형 포함, `lib/queries.ts` 의 `MADE`) → 원작자 페이지 '추천한 글' 탭, 기여 집계·명예의 전당·월간 메일에서 제외.
   - 다른 스킬을 고쳐 만든 경우 `based_on`(원본 스킬) 연결 → "원작: ○○ by △△", 원본 글에는 "파생 스킬 N개".
   - 버전마다 올린 사람(`uploaded_by`) 기록 → 기여자 목록은 이것으로 계산(별도 테이블 없음).
   - 원작자 페이지: 그 원작자의 스킬, 받은 좋아요 합계, 설치 합계.
3. **좋아요** — 사용자당 스킬 1회 토글. `(user_id, skill_id)` PK 로 DB 가 중복을 막는다.
4. **스냅샷(결과물 미리보기)** — 이미지 여러 장(첫 장이 썸네일) + 선택적 데모 HTML 1개. 데모는 `<iframe sandbox="allow-scripts">` + 응답 CSP `form-action 'none'`(`DEMO_CSP`). `allow-same-origin` 절대 금지.
   - **데모 바꿔치기 방지**: 에디터가 아닌 사람이 전사 공개 글의 데모를 바꾸면 그 데모는 `pending` 으로 저장돼 **재승인 전까지 남에게 숨긴다**(이미지·썸네일은 그대로). 상세·`/files` 모두 `onlyApproved` 면 막고, 승인(`review`)하면 그 글의 pending 데모가 풀린다. 지정 공개는 검수 흐름이 없어 대상 아님.
5. **설명** — 요약(한 줄), 본문(마크다운), 분류, 태그, `SKILL.md` 원문, 버전 이력.
6. **설치** — 받는 zip 은 안에 `<name>/` 폴더 하나(`inFolder`, Claude 앱 업로드 규격). 상세에 두 가지 안내: Claude 앱(웹·데스크톱)은 Customize → Skills → Upload a skill 로 zip 그대로, Claude Code 는 `~/.claude/skills/` 에 풀기. 앱에 올린 스킬·플러그인은 같은 계정의 Claude Code 에도 동기화된다. 플러그인 글은 `/plugin marketplace add owner/repo` 에서 저장소를 뽑아 앱 안내(Customize → Plugins → Add marketplace)도 보여 준다. 다운로드마다 `installs` 에 기록, 설치 수는 받아 간 사람 수(본인 제외)로 센다.
7. **공개 범위** — `public`(전사) / `restricted`(지정한 이메일만). 소유자가 언제든 전환.
   - `restricted` 는 허용 이메일(`skill_access`) + 소유자 + 에디터만 본다. 허용 이메일은 아직 가입 안 한 사람이어도 된다.
   - 목록·검색·게시글·다운로드·스냅샷 파일·원작자 집계 **모든 경로**에서 동일하게 막는다 → 스킬 조회는 반드시 `lib/queries.ts` 의 가시성 필터를 거친다. 직접 `SELECT … FROM skills` 금지.
   - 권한 없는 사람에게는 403 이 아니라 404 (존재 자체를 숨김).
   - `restricted` 스킬은 큐레이티드·에디터 픽 탭에 노출하지 않는다.

분류 초기값: 문서 · 슬라이드 · 웹 · 이미지 · 영상 · 데이터 · 개발 · 기타 (`categories` 테이블 값, 코드 하드코딩 금지).

## 회원가입·로그인 (이메일 인증 코드)

- 허용 도메인만: `@samsung.com`, `@cheil.com` (`ALLOWED_EMAIL_DOMAINS` 환경변수, 기본값 이 둘). **@ 뒤가 정확히 일치**해야 한다(`xsamsung.com`, `samsung.com.evil.io` 거부). 이메일은 소문자·trim 후 비교.
- 흐름: `/login` 에 이메일 입력 → 6자리 코드 메일 발송 → 코드 입력 → 로그인. 처음 인증한 이메일은 그 자리에서 가입, `/me` 에서 이름·부서 입력.
- 링크 대신 코드인 이유: 사내 메일 보안 스캐너가 링크를 먼저 열어 1회용 토큰을 소모하는 문제, 메일을 폰에서 열면 폰이 로그인되는 문제를 피한다.
- 코드: 10분 유효, 1회용, 코드당 입력 5회 초과 시 무효, DB 에는 해시만 저장. 발송 한도(`lib/login.ts`): 이메일당 10분 3통·하루 10통, 그 이메일로 틀린 코드가 하루 10번이면 그날 잠금(6자리 무작위 대입 방지), IP 당 시간 20통, 전체 하루 400통(Gmail 한도 보호).
- 로그인 후 이동(`next`)은 `safeNext`(URL 로 파싱해 같은 출처 경로만) — `/	/evil.com` 같은 값이 외부로 새지 않게.
- 세션: `session` 쿠키 = HMAC 서명(`AUTH_SECRET`)된 `user:<id>:<만료>`, 30일, httpOnly, sameSite=lax, https 일 때 Secure. 서버 저장 없음.
  - ponytail: 무상태 세션이라 강제 로그아웃 불가. 필요해지면 sessions 테이블로.
- 사이트 전체 로그인 필수(`proxy.ts` 가 서명 검사 후 `/login` 으로 보냄). 앱 코드는 `lib/auth.ts` 의 `getCurrentUser()` 하나로만 사용자를 얻는다.
- 메일 발송: Gmail SMTP(`nodemailer`, smtp.gmail.com:465 + 앱 비밀번호). 발신 전용 계정 `MAIL_USER`·`MAIL_PASS` 가 있으면 그걸로 보낸다(개인 메일 숨김) — `SMTP_USER`·`SMTP_PASS` 는 브리핑 IMAP(mk 보낸편지함)이 읽는 계정이라 그대로 둔다. Gmail 은 From 을 로그인 계정으로 되돌리므로 `MAIL_FROM` 주소는 발신 계정과 같게. `SMTP_HOST` 가 비어 있으면 로컬에선 코드를 서버 콘솔에 출력, Vercel 에선 에러.
  - ponytail: 개인 Gmail 은 하루 약 500통 한도. 사용자가 늘면 자체 도메인 + Resend 로.
- **에디터** = `EDITOR_EMAILS` 환경변수에 있는 이메일. 검수 승인·반려·에디터 픽·모든 스킬 수정/삭제 가능. ponytail: 변경 시 재시작 필요, 자주 바뀌면 users.role 컬럼으로.
- 스킬 수정·버전 추가·공개 범위 변경: 소유자 · 에디터.

## 스택

- Next.js 16 (App Router) + TypeScript, 서버 컴포넌트 + Server Actions. 별도 API 서버 없음. (Next 16: `middleware` → `proxy.ts`)
- 호스팅: Vercel(함수 리전 `icn1`, `vercel.json`). 프로젝트 `bizsinsightclubs-projects/skillmarket`.
- DB: Supabase Postgres(서울, Vercel Marketplace 연동). `pg`(node-postgres) 로 서버에서만 직접 접속(`POSTGRES_URL` = Supavisor 트랜잭션 풀러).
  - postgres.js 를 쓰지 않는 이유: `prepare:false` 에서 매개변수 쿼리를 '형식 묻기 → 실행' 두 번 왕복으로 보내, 그 사이 함수가 멈추면 풀러의 DB 연결이 ClientRead 로 묶여 풀이 바닥나고 페이지가 2분씩 멈췄다(2026-10-06). pg 는 한 번에 보낸다.
  - 테이블은 전부 **`app` 스키마** → Supabase Data API(공개 키로 접근 가능한 REST)는 `public` 만 노출하므로 닿지 않는다. 쿼리에서 `app.테이블` 로 적는다.
  - `lib/db.ts` 의 `Db` 인터페이스(`query`/`tx`)만 쓴다. 파라미터는 `$1…`, 동적 SQL 은 `Params`.
  - id·카운트는 `int`(`COUNT(*)::int`) — pg 는 bigint(int8) 를 문자열로 준다.
- 파일: Supabase Storage 비공개 버킷 `uploads`(파일당 20MB). 서버만 secret 키 사용.
  - Vercel 함수 요청·응답 본문 한도 4.5MB → **업로드는 브라우저가 1회용 서명 URL 로 Storage 에 직접**(`components/direct-upload.ts` → `prepareUpload`), 서버는 `tmp/<user_id>/…` 를 내려받아 검증 후 최종 경로로 다시 저장하고 tmp 삭제.
  - 다운로드·이미지는 가시성 검사 후 Storage 서명 URL 로 302. 데모 HTML 만 함수가 직접 응답(격리 헤더 때문, 그래서 4MB 제한).
- 메일: `nodemailer`(Gmail SMTP).
- 스타일: Tailwind v4(`app/globals.css` 의 `@utility glass/glass-dark/panel`). 폰트: Pretendard Variable(OFL, npm `pretendard` dynamic subset 자체 호스팅, 외부 CDN 없음).
- 디자인 레퍼런스 수집: `design/refs.py`(C:/pjt/mobbin 의 Mobbin API 래퍼 재사용). 원본 이미지·캐시는 gitignore.
- 마크다운: `react-markdown` + `remark-gfm`, `skipHtml`. 원시 HTML 렌더링 플러그인(`rehype-raw`) 금지 — 위험한 URL 은 기본값이 걸러준다.

## 데이터 모델 (요약 — 정본은 `db/migrations/`, 모두 `app` 스키마)

```
users(id, email UNIQUE, name, department, created_at, last_login_at)
login_codes(id, email, code_hash, expires_at, attempts, consumed_at, created_at)
categories(slug, label, sort_order)
skills(id, slug UNIQUE, name, summary, body_md, category, tags,
       author_name, author_email, owner_id→users, based_on_skill_id→skills NULL,
       visibility['public'|'restricted'],
       curation_status['none'|'pending'|'approved'|'rejected'], curated_version_id NULL,   -- 승인 버전
       picked_at NULL, revoked_at NULL, author_confirmed NULL, agreed_at NULL,             -- 에디터 픽·승인 취소·원작자 확인·등록 동의
       embedding real[] NULL,                                                              -- 의미 검색용 Voyage 임베딩(없으면 키워드 폴백)
       topic text NULL,                                                                     -- 링크형 분야 폴더(lib/topics.ts, Haiku 분류, NULL=기타)
       ai_desc text NULL,                                                                   -- 링크형 README 기반 AI 소개(lib/describe.ts). NULL=아직, ''=근거 없음
       gist text NULL,                                                                      -- 핵심 한 줄(35자 안팎, Haiku, 모든 종류) — 검수 대기함 카드
       stars int NULL, stars_at timestamptz NULL,                                           -- 링크형 GitHub 스타(유사도 지도 크기 토글)
       created_at, updated_at)
skill_versions(id, skill_id, version, zip_path, skill_md, uploaded_by→users, changelog, created_at,
               diagram_path NULL, principle NULL)                    -- archify 구조도 HTML 경로·작동 원리(버전별)
skill_access(skill_id, email)
curation_reviews(id, skill_id, version_id, editor_id→users, decision, note, created_at)
snapshots(id, skill_id, kind['image'|'demo'], path, sort_order, pending)   -- pending=데모 재승인 전 숨김
likes(user_id, skill_id, created_at)
installs(id, skill_id, version_id, user_id, created_at)   -- 트렌딩 계산용 이벤트 로그
posts(id, author_id, title, body_md, link_url, created_at, updated_at)            -- AI Breakthrough
comments(id, skill_id NULL, post_id NULL, parent_id NULL, author_id, body, deleted, created_at)  -- 둘 중 하나에만
comment_reactions(user_id, comment_id) · post_reactions(user_id, post_id) · post_images(path, uploader_id)
briefing_seen(url)                                          -- 브리핑에서 처리한 저장소
uses(user_id, skill_id, created_at)                         -- 써봤어요
author_history(id, skill_id, author_name, author_email, changed_by→users, created_at)
reports(id, skill_id, reporter_id, reason, created_at, resolved_at, resolved_by, resolution)  -- 출처 신고
digest_sent(month, email, sent_at)                          -- 월간 기여 메일 보낸 기록
skill_scans(version_id PK, score, recommendation, findings jsonb, tool_version, scanned_at)  -- NVIDIA skillspector 검사(버전별)
mail_log(id, kind, email, created_at)                       -- 알림 메일 발송 기록(한도용, 글 삭제와 무관)
```
좋아요·설치 수는 집계 쿼리. 느려지면 그때 카운터 컬럼.
트렌딩 점수 = 최근 7일 (받아 간 사람 + 좋아요 × 3).

## 보안 규칙 (생략 금지)

- zip: 경로 탈출(`../`, 절대경로) 거부, zip 20MB · 압축 해제 50MB · 파일 500개 상한, 재압축으로 심볼릭 링크 제거.
- 업로드 이미지는 파일 앞 바이트로 판별(png/jpg/webp/gif), 장당 5MB·10장. SVG 불가.
- 데모 HTML 은 sandbox iframe 전용 + 응답 헤더 `Content-Security-Policy: sandbox allow-scripts; form-action 'none'`(`DEMO_CSP`, 직접 열어도 격리·폼 바깥 전송 차단). 가능하면 별도 오리진. HTML 앱도 같은 원칙(권한·CSP 는 `APP_SANDBOX`/`APP_CSP`, 테스트가 allow-same-origin 금지·form-action 'none' 을 지킨다). ponytail: allow-scripts 라 스크립트 fetch 로의 유출까지 막으려면 별도 오리진이 필요(미정) — 로그인 코드 피싱은 메일 경고로도 방어.
- 업로드 파일은 비공개 버킷에만. `/files/…` 라우트가 가시성 검사 + DB 에 등록된 경로만 서빙. 이미지는 판별한 MIME 으로, 데모는 `text/plain` 으로 다시 저장(Storage 주소로 직접 열려도 실행 안 됨).
- 임시 업로드 경로는 `tmp/<본인 user_id>/<uuid>` 만 받는다(남의 업로드 가로채기 방지).
- `SUPABASE_SECRET_KEY`/`SERVICE_ROLE_KEY` 는 서버 전용. 클라이언트에는 `NEXT_PUBLIC_SUPABASE_URL`·`PUBLISHABLE_KEY` 만.
- 스킬 안의 스크립트는 서버에서 **절대 실행하지 않는다**.
- 업로드된 `SKILL.md`·본문은 sanitize 후 렌더링.
- Server Action 마다 로그인·권한을 서버에서 다시 확인(버튼 숨김은 보안이 아님).
- 서명·코드 비교는 `crypto.timingSafeEqual`.
- Server Action 인자는 브라우저가 마음대로 보낼 수 있다 → 값뿐 아니라 모양(허용된 field 등)까지 검사.
- 보안 헤더는 `next.config.ts`(X-Frame-Options SAMEORIGIN — 데모 iframe 이 같은 출처라 DENY 불가, nosniff, Referrer-Policy, X-Powered-By 끔).
- 점검 이력: 2026-10-06 Strix 방식(정찰→범주별 점검→PoC) 자체 점검. 남은 위험은 아래 '미정 사항'.

## 배포 (Vercel)

- `npx vercel deploy --prod`. 빌드가 먼저 `scripts/migrate.ts`(DB 마이그레이션 + 버킷 생성)를 돌린다 — advisory lock 으로 동시 빌드에도 한 번만.
- 로컬: `npx vercel env pull` 로 `.env.local` 을 받은 뒤 `npm run dev`. **로컬도 운영과 같은 Supabase DB 를 쓴다** — 테스트 데이터는 지울 것.
  - ponytail: DB 하나를 공유. 분리가 필요해지면 Supabase 브랜치나 별도 프로젝트.
- 환경변수: Supabase 연동이 자동으로 넣는 `POSTGRES_*`·`SUPABASE_*`·`NEXT_PUBLIC_SUPABASE_*` + 직접 넣는 `AUTH_SECRET`(필수), `SMTP_HOST`·`SMTP_PORT`·`SMTP_USER`·`SMTP_PASS`, `MAIL_USER`·`MAIL_PASS`(선택, 발신 전용 Gmail+앱 비밀번호 — 없으면 SMTP_USER 로 발신), `MAIL_FROM`(선택, 기본 `스킬마켓 <발신계정>`), `EDITOR_EMAILS`, `CRON_SECRET`(브리핑·월간 메일 Cron), `ALLOWED_EMAIL_DOMAINS`(선택), `SENSITIVE_TERMS`(선택, 업로드를 막을 광고주명 등 쉼표 구분 — 공개 저장소라 코드에 넣지 않는다), `SITE_URL`(선택, 메일 속 링크 주소 — 없으면 Vercel 운영 도메인), `VOYAGE_API_KEY`(선택, 의미 검색 임베딩용 Voyage — 없으면 키워드 검색), `ANTHROPIC_API_KEY`(선택, AI 추천 챗봇·분야 분류·README 소개·핵심 한 줄용 Haiku + 구조도용 Opus — 없으면 해당 기능만 빠짐), `GITHUB_TOKEN`(선택, 스타 갱신 한도 완화). 환경변수를 바꾸면 재배포해야 반영된다.

## 폴더 구조

```
app/                  라우트
lib/                  db.ts        Db 인터페이스(pg) + 마이그레이션 실행기
                      community.ts 댓글·공감·게시판 규칙(테스트)   community-actions.ts 그 서버 액션
                      link-post.ts 링크형 글(플러그인·MCP) 입력 검증
                      lens-file.ts The Lens 렌즈 .md 검증·추출
                      html-app.ts  HTML 앱 파일 검증·격리 권한·저장소 대체
                      test-db.ts   테스트용 PGlite(메모리 Postgres) Db
                      auth.ts      getCurrentUser / requireViewer / isEditor
                      sign.ts      HMAC 서명·세션 토큰        login.ts  도메인 검사·인증 코드
                      mail.ts      SMTP 발송                  queries.ts 모든 스킬 조회(가시성 필터)
                      skill-zip.ts zip 검증·재압축·이미지 판별  storage.ts Supabase Storage(서버 전용)
                      curation.ts  승인·반려·에디터 픽·자동 검수 요청  format.ts 날짜(KST) 표시
                      credit.ts    원작자 기록·확인, 출처 신고    sensitive.ts 업로드 민감정보 검사
                      digest.ts    월간 기여 메일 대상 고르기
                      briefing.ts  브리핑 메일 해석·글 등록      briefing-mail.ts Gmail IMAP(보낸편지함)
                      describe.ts  링크형 README → Haiku 소개(ai_desc)·핵심 한 줄(gist)·GitHub 스타  topics.ts 분야 분류  ask.ts 추천 챗봇
                      diagram.ts   스킬 zip → Claude → archify 구조도 + 작동 원리
vendor/archify/       tt-a1i/archify 사본(MIT, 예제·테스트 제외) — 구조도 렌더·검증 CLI
                      actions.ts / skill-actions.ts / editor-actions.ts  Server Actions
components/           comments·comment-form(댓글 영역), post-form(게시판 글), submit-button(처리 중 표시), skill-card(카드·표지·그리드·byline), pick-spotlight(홈 에디터 픽 회전), catalog(목록), the-lens-intro(전문가 탭 소개), skill-form, markdown, review-form, copy-button, direct-upload(브라우저→Storage)
scripts/migrate.ts    빌드 전 마이그레이션 + 버킷 준비
db/migrations/        *.sql (Postgres, app 스키마)
```

## 작업 규칙

- 한국어 UI. 문구는 짧게.
- 새 의존성 추가 전: 표준 라이브러리·Next 기본 기능·이미 있는 패키지로 되는지 먼저 확인.
- 로직이 있는 부분(도메인 검사, 코드 검증, 서명, zip 검증, 가시성 필터, 트렌딩, 큐레이션 버전 고정)은 테스트를 남긴다. `*.test.ts` 를 `npm test`(= `node --test`, Node 24 타입 스트리핑)로 실행. DB 테스트는 `testDb()`(PGlite) — 네트워크·운영 DB 불필요. 테스트 대상 모듈은 `@/` 별칭 대신 상대경로 + `.ts` 확장자로 import.
- 명령: `npm run dev` / `npm run build`(마이그레이션 포함) / `npm run db:migrate` / `npm test` / `npm run scan`(안전검사, 에디터 PC) / `npm run diagram`(구조도 수동 생성).

## 미정 사항

- 버려진 임시 업로드(`tmp/`) 정리 — ponytail: 지금은 제출 시 삭제만. 쌓이면 Vercel Cron 으로 하루 1회 정리
- 남은 보안 위험(2026-10-06 점검) — ponytail: ①업로드 URL 발급 횟수 상한 없음(로그인한 사내 사용자가 Storage 를 채울 수 있음, 남용되면 발급 기록 테이블로 사용자당 상한) ②CSP 없음(마크다운 skipHtml·React 이스케이프로 XSS 경로는 막혀 있음, 필요하면 nonce CSP) ③세션 강제 만료 불가(위 '세션' 참고)

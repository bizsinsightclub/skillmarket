@AGENTS.md

# skillmarket — 사내 Claude 스킬 마켓플레이스

사내 구성원이 만든 Claude 스킬(`SKILL.md` 폴더)을 올리고, 찾고, 설치하는 웹서비스. Vercel 공개 호스팅(https://skillmarket-beta.vercel.app), 가입은 사내 메일만.
기능 레퍼런스: https://skillry.dev (트렌딩/인기 정렬 · 결과물 미리보기 · 설치 수). 결제·구독 기능은 **가져오지 않는다**.
화면은 **skillry 형 카드 그리드**: 결과물 썸네일(16:10)이 주인공, 이미지 없는 스킬은 이름·분류로 자동 표지(`Cover`). 글래스모피즘(고정 메쉬 그라디언트 위 `glass`·`glass-dark`·`panel` 유틸) + Pretendard Variable + 라임 강조(`accent`). **디자인을 고칠 때는 `design/DESIGN.md` 의 원칙을 먼저 읽는다.**

## 화면

- `/` 홈 — 소개 한 줄 + **에디터 픽 조명**(`components/pick-spotlight.tsx`, 최근 선정 순, 6초마다 회전, 호버·포커스·탭 숨김·동작 줄이기 설정 시 정지) + 섹션: 요즘 뜨는 스킬(최근 7일 활동 있는 것만) · 새로 올라온 스킬 · 전문가 렌즈 · AI Breakthrough 최근 글 · 추천 플러그인·MCP. 검색은 헤더 하나만.
- `/skills` 스킬 · `/plugins` 플러그인·MCP · `/experts` 전문가 렌즈 · `/picks` 에디터 픽 — 모두 `components/catalog.tsx`. 탭(전체/에디터 픽), 그 종류의 분류 칩, 정렬(최신·트렌딩·인기, `/picks` 는 최근 선정), 검색(`?q=`, 헤더 검색창은 `/skills`), 카드 그리드, 페이지네이션(20개). 스킬과 플러그인·MCP 는 목록에서 섞지 않는다(`listBoard` 의 `kind`).
  - 카드: 썸네일 위 왼쪽 배지(에디터 픽/검수 완료/비공개), 오른쪽 아래 설치·좋아요 수, 아래 이름·분류·요약·원작자.
- `/skills/[slug]` 상세 — 왼쪽 결과물 이미지·데모(크게), 오른쪽 고정 패널(배지, 이름+버전, 좋아요, 설치 명령 복사·ZIP 받기, 크레딧, 태그, 수정), 아래 설명·설치 방법·SKILL.md·큐레이션·버전 이력·파생 스킬.
- `/write` 글쓰기(업로드) · `/skills/[slug]/edit` 수정 · `/skills/[slug]/versions/new` 새 버전.
- `/u/[email]` 원작자 페이지(합계 + 카드) · `/me` 내 정보 · `/login` 로그인 · `/editor` 검수 대기함(헤더 배지 = 대기 건수) · `/inbox` 알림함(내 글의 검수 결과·남의 좋아요·남의 댓글, 내 댓글에 달린 남의 답글. 별도 테이블 없이 기존 기록에서 조회, `users.inbox_seen_at` 이후 = 안 읽음).
- `/board` **AI Breakthrough** 게시판(앰버 색) · `/board/new` 글쓰기 · `/board/[id]` 글(마크다운 본문 + 참고 링크 + 공감 + 댓글) · `/board/[id]/edit`. 글쓴이·에디터만 수정·삭제.
- **썸네일**: 이미지를 올리지 않으면 `/skills/[slug]/cover`(next/og)가 입력한 정보(종류·이름·요약·만든 곳/기반·태그)로 그린다. `?v=updated_at` 캐시 키. 폰트는 Pretendard otf(`next.config.ts` 의 outputFileTracingIncludes). **숫자(스킬 n개 등) 넣지 않는다.**

## 에디터 픽 (큐레이티드와 통합 — 2026-10-02)

- **에디터 픽 = 에디터가 승인한 글**(`curated_version_id IS NOT NULL`). 따로 켜고 끄는 픽 플래그는 없다(`skills.editor_pick` 컬럼은 미사용 — 다음 정리 때 삭제).
- 흐름: 작성자가 검수 요청 → 에디터가 승인(= 에디터 픽) / 반려(사유 필수). 에디터는 요청 없이도 승인 가능, "에디터 픽에서 내리기"로 해제.
- 승인은 에디터가 본 `version_id` 로 고정 → 이후 새 버전이 올라와도 에디터 픽은 승인된 버전을 보여주고 설치시킨다(상세의 설치 버튼·SKILL.md = 승인 버전, 최신은 '검수 전' 보조 링크). 새 버전은 다시 검수 요청해야 교체.
- 링크형은 설치 명령·공식 페이지가 버전 파일 대신 → 에디터가 아닌 사람이 이걸 바꾸면 에디터 픽이 내려간다(재검수).
- `curation_status` 는 마지막 검수 요청의 상태일 뿐(재검수 대기·반려 중에도 이전 승인 버전은 에디터 픽에 남는다).
- 홈 조명·`/picks` 는 **최근 선정 순**(`sort=picked`, 승인 리뷰의 `created_at`) → 새로 검수 통과한 스킬이 앞에 온다. 비공개 글은 에디터 픽 목록에 나오지 않는다.

## 바이브코딩 아침 브리핑 자동 등록 (2026-10-06)

- 매일 아침 mk.kansas@gmail.com 이 자기에게 보내는 "바이브코딩 아침 브리핑 - 날짜" 메일(GitHub 트렌딩 목록)을 **오픈소스 링크형 글 + 검수 대기(pending)** 로 올린다 → 에디터가 검수 대기함에서 설치 방법을 보태고 승인.
- Vercel Cron(`vercel.json`, 매일 01:00 UTC = 10:00 KST) → `/api/cron/briefing`. `proxy.ts` 로그인 검사에서 빠지고 `Authorization: Bearer CRON_SECRET` 로만 연다.
- 메일 읽기 `lib/briefing-mail.ts`: SMTP 와 같은 Gmail 앱 비밀번호로 IMAP, **보낸편지함에서만** 찾는다(최근 3일) — From 위조 메일로 글이 올라가지 않게. GitHub 주소(`https://github.com/owner/repo`)인 항목만.
- 해석·저장 `lib/briefing.ts`(테스트 있음): "N. 이름 — 덧말 / 주소 / 설명" 형식. 같은 저장소 주소(대소문자·끝 / 무시)나 같은 이름이 있으면 건너뛴다 → 몇 번을 돌려도 중복 없음. 처리한 저장소는 `briefing_seen` 에 남겨, 에디터가 지운 글이 다음 브리핑에 또 나와도 되살리지 않는다. 올린 사람·추천인 = `EDITOR_EMAILS` 첫 번째.
- ponytail: README 를 읽어 설치 명령·주의점을 채우는 건 하지 않는다(LLM 필요) — 지금은 브리핑 설명 + 저장소 링크만, 나머지는 에디터가 수정.

## 댓글·공감 (2026-10-06)

- 스킬·플러그인·렌즈 글과 게시판 글 아래 같은 댓글 영역(`components/comments.tsx`). 평문(마크다운 아님), 2000자.
- 대댓글은 한 단계: 답글의 답글도 최상위 댓글 아래에 붙는다(`lib/community.ts` 의 `addComment`).
- 공감 = 사용자당 1회 토글(댓글·게시판 글). 스킬 글은 기존 좋아요를 그대로 쓴다.
- 삭제는 글쓴이·에디터. 답글이 달린 댓글은 "삭제된 댓글" 자리만 남는다.
- 비공개 스킬의 댓글: 쓰기·지우기·공감 모두 서버 액션이 `getSkill`(가시성)로 다시 확인한다 — 못 보는 사람은 404.

## 핵심 기능 (이 범위 밖은 요청 전까지 만들지 않는다)

0. **세 종류의 글** — 분류의 `categories.post_type`(skill·link·lens)이 정한다. 코드에 분류 이름을 하드코딩하지 않는다. (`needs_zip` 컬럼은 미사용 — 다음 정리 때 삭제)
   - 스킬(zip): 아래 1~6 전부.
   - **링크형(플러그인·MCP 서버·오픈소스)**: 오픈소스 = 플러그인·MCP 가 아닌 추천 저장소(앱·DB·커리큘럼 등). zip 없이 `install_cmd`(설치 명령) + `homepage_url`(http/https 만) + `maker`(만든 곳, 외부). 크레딧의 원작자 칸은 **추천인**. 다운로드·새 버전·SKILL.md 없음, 설치 수 표시 안 함.
   - 링크형도 큐레이션 모델을 그대로 쓰려고 `version='link'`, `zip_path=''` 인 '등록본' 버전 한 줄을 만든다(`lib/link-post.ts`). 수정해도 새 버전이 생기지 않는다.
   - **렌즈(전문가 탭 `/experts`)**: The Lens(`C:/pjt/magilite`)의 렌즈 `.md` 파일. 첫 펜스드 코드블록 = 시스템 프롬프트(magilite `extract_system_prompt` 와 같은 규칙), `# 역할`·`# 오퍼레이션`·`# 출력 형식` 필수(`lib/lens-file.ts`). `person`(기반 인물)·`basis`(기반 방법론) 입력, `bands`(오퍼레이션 단계)는 파일에서 추출. 버전 파일은 `.md` 로 저장·다운로드.
     - **The Lens 원칙을 따른다**: 실존 인물의 공개된 방법론을 기준으로 삼되 인물 연기 금지, 화면 표기는 '○○ 기반'(출처 표기). 초상 사진 이용 권한은 올리는 사람 책임.
     - The Lens 로 바로 설치하는 연동은 아직 없다(The Lens 에 파일 가져오기·마켓의 expert 종류 지원이 없음 — 2026-10-02 조사). 지금은 .md 다운로드·프롬프트 복사.
     - 헤더 = `[로고 · 메뉴 상자]` ··· `[검색 · 이름 · 내정보 · 알림함 · 검수대기함(에디터만) · 올리기]`. 메뉴 상자(`components/nav-menu.tsx`)는 메뉴마다 고유 색·아이콘(스킬 라임 · 플러그인 하늘 · 전문가 퍼플 · AI Breakthrough 앰버). 휴대폰에선 메뉴 상자가 둘째 줄(옆으로 밀기), 로고는 '스킬마켓' 글자만. 에디터 픽은 홈 조명이 맡아 메뉴에 없다. 페이지가 `<span hidden data-tab="/experts">` 같은 표식을 그리면 `globals.css` 의 `body:has([data-tab=…])` 규칙이 그 메뉴를 꽉 찬 색으로(JS 없음).
     - **색으로 구분**: 전문가 탭·렌즈 카드·상세는 The Lens 브랜드 퍼플(`lens`·`lens-2`·`lens-deep`·`lens-bg`·`lens-ink` 토큰, magilite `static/theme.css` 값 그대로). 다른 탭은 라임(`accent`).
     - 상단 소개(`components/the-lens-intro.tsx`) + 소개 영상은 **공개 저장소에 넣지 않는다**(사내 초안) — Storage 비공개 버킷 `uploads/site/the-lens-intro.mp4`(+ `-poster.jpg`), `/media/[name]` 라우트가 로그인 확인 후 서명 URL 로 넘긴다. 교체는 Storage 파일만 덮어쓰기.
   - 수정할 때 글 종류(스킬·링크형·렌즈) 사이로 분류를 바꿀 수 없다.

1. **업로드** — 스킬 폴더 zip. `SKILL.md` 는 zip 루트 또는 최상위 폴더 한 겹 안. frontmatter `name`·`description` 필수, 이름·요약 기본값으로 쓴다. `name` 은 Claude 스킬 규격(영문 소문자·숫자·하이픈 64자, anthropic·claude 금지), `description` 1024자 이내 — 어긋나면 Claude 앱 업로드가 거부되므로 올릴 때 막는다.
   - 서버는 zip 을 디스크에 풀지 않는다. 메모리에서 검사한 뒤 **다시 묶어서**(정규 파일만, SKILL.md 루트) 저장 → 심볼릭 링크·이상한 속성이 설치자에게 가지 않는다.
2. **원작자 크레딧**
   - 원작자 1명(`author_name` + `author_email`). 올린 사람 ≠ 원작자일 수 있어 따로 입력(기본값 = 내 정보). 원작자는 가입자가 아니어도 된다.
   - 다른 스킬을 고쳐 만든 경우 `based_on`(원본 스킬) 연결 → "원작: ○○ by △△", 원본 글에는 "파생 스킬 N개".
   - 버전마다 올린 사람(`uploaded_by`) 기록 → 기여자 목록은 이것으로 계산(별도 테이블 없음).
   - 원작자 페이지: 그 원작자의 스킬, 받은 좋아요 합계, 설치 합계.
3. **좋아요** — 사용자당 스킬 1회 토글. `(user_id, skill_id)` PK 로 DB 가 중복을 막는다.
4. **스냅샷(결과물 미리보기)** — 이미지 여러 장(첫 장이 썸네일) + 선택적 데모 HTML 1개. 데모는 `<iframe sandbox="allow-scripts">` 로만. `allow-same-origin` 절대 금지.
5. **설명** — 요약(한 줄), 본문(마크다운), 분류, 태그, `SKILL.md` 원문, 버전 이력.
6. **설치** — 받는 zip 은 안에 `<name>/` 폴더 하나(`inFolder`, Claude 앱 업로드 규격). 상세에 두 가지 안내: Claude 앱(웹·데스크톱)은 Customize → Skills → Upload a skill 로 zip 그대로, Claude Code 는 `~/.claude/skills/` 에 풀기. 앱에 올린 스킬·플러그인은 같은 계정의 Claude Code 에도 동기화된다. 플러그인 글은 `/plugin marketplace add owner/repo` 에서 저장소를 뽑아 앱 안내(Customize → Plugins → Add marketplace)도 보여 준다. 다운로드 시 설치 수 +1.
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
- 메일 발송: Gmail SMTP(`nodemailer`, smtp.gmail.com:465 + 앱 비밀번호). `SMTP_HOST` 가 비어 있으면 로컬에선 코드를 서버 콘솔에 출력, Vercel 에선 에러.
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
       curation_status['none'|'pending'|'approved'|'rejected'], curated_version_id NULL,
       editor_pick, created_at, updated_at)
skill_versions(id, skill_id, version, zip_path, skill_md, uploaded_by→users, changelog, created_at)
skill_access(skill_id, email)
curation_reviews(id, skill_id, version_id, editor_id→users, decision, note, created_at)
snapshots(id, skill_id, kind['image'|'demo'], path, sort_order)
likes(user_id, skill_id, created_at)
installs(id, skill_id, version_id, user_id, created_at)   -- 트렌딩 계산용 이벤트 로그
posts(id, author_id, title, body_md, link_url, created_at, updated_at)            -- AI Breakthrough
comments(id, skill_id NULL, post_id NULL, parent_id NULL, author_id, body, deleted, created_at)  -- 둘 중 하나에만
comment_reactions(user_id, comment_id) · post_reactions(user_id, post_id)
briefing_seen(url)                                          -- 브리핑에서 처리한 저장소
```
좋아요·설치 수는 집계 쿼리. 느려지면 그때 카운터 컬럼.
트렌딩 점수 = 최근 7일 (설치 + 좋아요 × 3).

## 보안 규칙 (생략 금지)

- zip: 경로 탈출(`../`, 절대경로) 거부, zip 20MB · 압축 해제 50MB · 파일 500개 상한, 재압축으로 심볼릭 링크 제거.
- 업로드 이미지는 파일 앞 바이트로 판별(png/jpg/webp/gif), 장당 5MB·10장. SVG 불가.
- 데모 HTML 은 sandbox iframe 전용 + 응답 헤더 `Content-Security-Policy: sandbox allow-scripts`(직접 열어도 격리). 가능하면 별도 오리진.
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
- 환경변수: Supabase 연동이 자동으로 넣는 `POSTGRES_*`·`SUPABASE_*`·`NEXT_PUBLIC_SUPABASE_*` + 직접 넣는 `AUTH_SECRET`(필수), `SMTP_HOST`·`SMTP_PORT`·`SMTP_USER`·`SMTP_PASS`, `EDITOR_EMAILS`, `CRON_SECRET`(브리핑 Cron), `ALLOWED_EMAIL_DOMAINS`(선택). 환경변수를 바꾸면 재배포해야 반영된다.

## 폴더 구조

```
app/                  라우트
lib/                  db.ts        Db 인터페이스(pg) + 마이그레이션 실행기
                      community.ts 댓글·공감·게시판 규칙(테스트)   community-actions.ts 그 서버 액션
                      link-post.ts 링크형 글(플러그인·MCP) 입력 검증
                      lens-file.ts The Lens 렌즈 .md 검증·추출
                      test-db.ts   테스트용 PGlite(메모리 Postgres) Db
                      auth.ts      getCurrentUser / requireViewer / isEditor
                      sign.ts      HMAC 서명·세션 토큰        login.ts  도메인 검사·인증 코드
                      mail.ts      SMTP 발송                  queries.ts 모든 스킬 조회(가시성 필터)
                      skill-zip.ts zip 검증·재압축·이미지 판별  storage.ts Supabase Storage(서버 전용)
                      curation.ts  승인·반려·에디터 픽 규칙     format.ts 날짜(KST) 표시
                      briefing.ts  브리핑 메일 해석·글 등록      briefing-mail.ts Gmail IMAP(보낸편지함)
                      actions.ts / skill-actions.ts / editor-actions.ts  Server Actions
components/           comments·comment-form(댓글 영역), post-form(게시판 글), submit-button(처리 중 표시), skill-card(카드·표지·그리드·byline), pick-spotlight(홈 에디터 픽 회전), catalog(목록), the-lens-intro(전문가 탭 소개), skill-form, markdown, review-form, copy-button, direct-upload(브라우저→Storage)
scripts/migrate.ts    빌드 전 마이그레이션 + 버킷 준비
db/migrations/        *.sql (Postgres, app 스키마)
```

## 작업 규칙

- 한국어 UI. 문구는 짧게.
- 새 의존성 추가 전: 표준 라이브러리·Next 기본 기능·이미 있는 패키지로 되는지 먼저 확인.
- 로직이 있는 부분(도메인 검사, 코드 검증, 서명, zip 검증, 가시성 필터, 트렌딩, 큐레이션 버전 고정)은 테스트를 남긴다. `*.test.ts` 를 `npm test`(= `node --test`, Node 24 타입 스트리핑)로 실행. DB 테스트는 `testDb()`(PGlite) — 네트워크·운영 DB 불필요. 테스트 대상 모듈은 `@/` 별칭 대신 상대경로 + `.ts` 확장자로 import.
- 명령: `npm run dev` / `npm run build`(마이그레이션 포함) / `npm run db:migrate` / `npm test`.

## 미정 사항

- 버려진 임시 업로드(`tmp/`) 정리 — ponytail: 지금은 제출 시 삭제만. 쌓이면 Vercel Cron 으로 하루 1회 정리
- 남은 보안 위험(2026-10-06 점검) — ponytail: ①업로드 URL 발급 횟수 상한 없음(로그인한 사내 사용자가 Storage 를 채울 수 있음, 남용되면 발급 기록 테이블로 사용자당 상한) ②CSP 없음(마크다운 skipHtml·React 이스케이프로 XSS 경로는 막혀 있음, 필요하면 nonce CSP) ③세션 강제 만료 불가(위 '세션' 참고)

# 스킬마켓

사내 Claude 스킬을 올리고, 찾고, 설치하는 마켓플레이스. 플러그인·MCP 추천과 The Lens 전문가 렌즈도 함께 다룬다.

- **스킬** — `SKILL.md` 가 든 폴더(zip)를 올리면 결과물 미리보기와 함께 소개되고, 명령 한 줄로 설치한다.
- **플러그인·MCP** — 써 본 사람이 설치 명령·공식 페이지와 함께 추천한다.
- **전문가** — The Lens 의 전문가 렌즈(.md)를 공유한다. 실존 인물의 공개된 방법론을 기준으로 삼되 인물을 흉내 내지 않는다.
- **원작자 크레딧 · 좋아요 · 에디터 픽(검수) · 지정한 사람만 보기 · 알림함**

가입은 사내 메일(samsung.com · cheil.com)로 받는 6자리 코드로만 한다.

## 기술

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase(Postgres + Storage) · Vercel · Pretendard

## 로컬 실행

```bash
npm install
npx vercel env pull          # .env.local (Supabase 연동 변수 등)
npm run dev                  # SMTP 설정이 없으면 로그인 코드는 서버 콘솔에 찍힌다
npm test                     # node --test, DB 테스트는 메모리 Postgres(PGlite)
```

환경변수 목록은 `.env.example`, 설계·규칙·보안 원칙은 `CLAUDE.md`, 디자인 근거는 `design/DESIGN.md` 에 있다.

# 디자인 근거 — 글래스모피즘 + Pretendard 고도화 (2026-10-01)

디자인을 고칠 때는 이 문서의 원칙을 먼저 읽는다. 근거 없이 장식을 더하지 않는다.

## 레퍼런스

| 출처 | 무엇을 봤나 |
|---|---|
| Mobbin 로컬 레퍼런스 (`C:/pjt/mobbin/data/sheets/sheet-23·24`) | Google Photos(#290)·Ladder(#289) 크롬 없는 이미지 그리드, Peerspace(#282) 높이 다른 메이슨리, Airbnb(#287) 큰 사진+섹션 제목, **Liven(#299) 파스텔 그라디언트 위 반투명 흰 카드**, **Photoroom(#285) 떠 있는 알약형 툴바** |
| Raycast Store (raycast.com/store) | 강한 색 빛줄기 배경 위 **떠 있는 유리 내비 알약**, 가운데 큰 제목 + 유리 검색창 |
| Framer Marketplace (framer.com/marketplace) | 4열 이미지 카드, 카드 아래 이름·작성자 왼쪽 / 수치 알약 오른쪽, Trending·Best·Recent 세그먼트 |
| skillry.dev | 16:10 썸네일, 이미지 위 배지·수치 오버레이, 상세 = 왼쪽 큰 미리보기 + 오른쪽 고정 패널 |
| 글래스모피즘 가이드 (uxpilot.ai, halfaccessible.com, kreativagroup.com, newtarget.com) | 유리는 색 있는 배경이 있어야 보인다 · 절제해서 · blur 8–16px · 본문은 거의 불투명 바탕 · 미지원 브라우저 대체 · 블러 애니메이션 금지 |

> Mobbin API 신규 수집은 2026-10-01 기준 `403 Team or Enterprise plan required` 로 막혀 있다(`design/refs.py` 는 플랜이 복구되면 그대로 재실행 가능). 그래서 기존 로컬 레퍼런스 + 웹 레퍼런스로 대신했다.

## 원칙

| # | 원칙 | 근거 | 적용 |
|---|---|---|---|
| 1 | **유리는 '떠 있는 조작층'에만.** 내비·검색·상세 정보 패널·이미지 위 칩 | Raycast 내비, Photoroom 툴바, 가이드 "절제" | `.glass` 는 헤더, 홈 검색, 상세 패널, 필터 세그먼트, 로그인 카드에만 |
| 2 | **유리 밑엔 색이 있어야 한다 — 단, 은은하게.** 평평한 미색 위 유리는 그냥 흰 박스지만, 색이 강하면 눈이 피곤하다(사용자 피드백 2026-10-01) | 가이드 공통, Liven | 화면 전체 고정 메쉬 그라디언트, 각 색 불투명도 0.16~0.22. 히어로는 어두운 바탕에 0.12~0.14 빛 번짐만. 이미지 없는 표지도 채도 25~28% |
| 3 | **글 읽는 곳은 거의 불투명.** 설명·설치 방법·SKILL.md 블록은 흰 90% | newtarget "본문은 solid 위" | `.panel`(흰 88%, 블러 없음) |
| 4 | **블러를 꺼도 읽혀야 한다.** 유리 바탕 흰 60% 이상 → `backdrop-filter` 미지원이어도 대비 유지 | 가이드 fallback | `@supports not (backdrop-filter)` 에서 흰 92% |
| 5 | **이미지가 주인공, 카드 크롬 최소.** 테두리 대신 아주 옅은 링, 메타는 이미지 밖 아래 | Google Photos, Ladder, Framer | 카드 = 썸네일 + 2줄 텍스트 |
| 6 | **이미지 위 정보는 어두운 유리 칩.** 밝은 이미지에서도 읽히게 | skillry, 가이드 "dark scrim" | `.glass-dark` 칩(검정 45% + blur 6px) |
| 7 | **큰 제목 + 가운데 검색이 첫 화면.** 마켓의 첫 행동은 '찾기' | Raycast Store, Framer | 홈 히어로를 유리 검색 중심으로 |
| 8 | **글자 위계는 굵기 3단 + 자간.** Pretendard 400/600/800, 큰 제목은 자간 -0.03em | Mobbin 프로젝트(Pretendard 2웨이트 위계) | `tracking-tight` 제목, 본문 400 |

## 성능 규칙

- `backdrop-filter` 는 한 화면에 큰 면 3~4개 + 작은 칩까지만. 카드마다 큰 유리 금지.
- 블러 값 6~20px, 애니메이션·트랜지션에 블러 넣지 않는다(호버는 transform 만).
- 배경 메쉬는 `position: fixed` 한 장 — 스크롤 때 다시 그리지 않는다.

## 폰트

- **Pretendard Variable** (SIL OFL 1.1, 무료 상업 사용 가능) — npm `pretendard` 의 dynamic subset CSS 를 `app/layout.tsx` 에서 import.
  Next 가 woff2 를 자체 호스팅으로 묶고, 브라우저는 쓰인 글자 범위의 조각만 받는다(92개 unicode-range).
- 외부 CDN 없음.

import { strToU8, zipSync } from "fflate";

// 처음 올리는 사람용 SKILL.md 양식. 받은 zip 의 폴더 이름·name 만 바꿔 채우면 그대로 올릴 수 있다.
const SKILL_MD = `---
name: my-skill
description: 이 스킬이 하는 일과 언제 쓰는지 한두 문장으로 적습니다. Claude 는 이 설명을 보고 스킬을 꺼내 씁니다. (1024자 이내)
---

# 스킬 이름

## 언제 쓰나
- 예: 주간 보고서 초안을 만들 때

## 하는 일
1. 사용자가 준 자료를 읽는다
2. ...
3. 결과물을 만든다

## 입력
- 사용자에게 받을 것: ...

## 출력
- 결과물 형식: (예: 마크다운 표, .pptx, HTML 한 파일)

## 지킬 것
- 광고주·고객 정보, 개인정보, 비밀번호·API 키는 넣지 않는다.
`;

const README = `이 폴더를 고쳐서 스킬을 만드세요.

1. 폴더 이름과 SKILL.md 의 name 을 같은 이름으로 바꿉니다 (영문 소문자·숫자·하이픈, anthropic·claude 는 쓸 수 없음).
2. SKILL.md 의 description 과 본문을 채웁니다.
3. 스크립트·참고 파일이 있으면 이 폴더 안에 함께 넣습니다.
4. 폴더째 zip 으로 묶어 스킬마켓 '올리기'에서 올립니다.

이 README.txt 는 지워도 됩니다.
`;

export function GET() {
  const zip = zipSync({ "my-skill/SKILL.md": strToU8(SKILL_MD), "my-skill/README.txt": strToU8(README) }, { level: 6 });
  return new Response(zip, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="my-skill-template.zip"', "Cache-Control": "private, max-age=3600" },
  });
}

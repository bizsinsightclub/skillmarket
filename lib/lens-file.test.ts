import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLensFile } from "./lens-file.ts";
import { UploadError } from "./skill-zip.ts";

const body = "규칙 설명 ".repeat(30);
const LENS = `﻿# EXPERT-09: 리테일 분석 — 누군가의 매장 독법 (Retail) v1.0\r
\r
> ⚠ 인물 연기가 아니다.\r
> 공개된 방법론을 실행 표준으로 삼는다.\r
\r
## SYSTEM PROMPT (그대로 복사하여 사용)\r
\r
\`\`\`\r
# 역할\r
너는 분석가다. ${body}\r
# 오퍼레이션 (반드시 이 순서대로)\r
1단계 — WALK (동선 관찰): 매장을 걷는다.\r
2단계 — SHELF (진열 해석): 진열을 읽는다.\r
3단계 — PRICE: 가격을 본다.\r
# 출력 형식\r
[진단 한 줄]\r
\`\`\`\r
\r
## 품질 검증\r
\`\`\`\r
두 번째 블록은 무시\r
\`\`\`\r
`;

test("렌즈 파일: 제목·이름·첫 코드블록·단계·소개문 추출", () => {
  const r = parseLensFile(LENS);
  assert.equal(r.title, "EXPERT-09: 리테일 분석 — 누군가의 매장 독법 (Retail) v1.0");
  assert.equal(r.name, "리테일 분석");
  assert.ok(r.prompt.startsWith("# 역할") && !r.prompt.includes("두 번째 블록"));
  assert.deepEqual(r.operations, ["WALK (동선 관찰)", "SHELF (진열 해석)", "PRICE"]);
  assert.equal(r.preamble, "⚠ 인물 연기가 아니다.\n공개된 방법론을 실행 표준으로 삼는다.");
});

test("렌즈 파일: 코드블록·필수 절 없으면 거부", () => {
  assert.throws(() => parseLensFile("# 제목\n그냥 글"), UploadError);
  assert.throws(() => parseLensFile(LENS.replace("# 출력 형식", "# 형식")), /출력 형식/);
  assert.throws(() => parseLensFile("# t\n```\n# 역할\n# 오퍼레이션\n# 출력 형식\n```"), /200~12000/);
});

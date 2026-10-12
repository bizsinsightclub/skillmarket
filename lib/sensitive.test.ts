import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { scan, zipTexts, envTerms } from "./sensitive.ts";

const labels = (text: string, terms: string[] = []) => scan({ 본문: text }, terms).map((f) => f.label);

test("개인정보·키·대외비 표시를 잡는다", () => {
  assert.deepEqual(labels("연락처 010-3456-7812"), ["휴대전화 번호"]);
  assert.deepEqual(labels("주민번호 900101-1234567"), ["주민등록번호"]);
  assert.deepEqual(labels("ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwx"), ["Anthropic API 키"]);
  assert.deepEqual(labels("aws AKIAIOSFODNN7EXAMPLE"), ["AWS 액세스 키"]);
  assert.deepEqual(labels("-----BEGIN RSA PRIVATE KEY-----"), ["개인 키"]);
  assert.deepEqual(labels("이 문서는 대외비입니다"), ["대외비 표시"]);
});

test("흔한 예시 값·일반 문장은 통과", () => {
  assert.deepEqual(labels("예: 010-0000-0000, 010-1234-5678"), []);
  assert.deepEqual(labels("API 키는 환경변수 ANTHROPIC_API_KEY 에 넣으세요. sk-ant-... 형식"), []);
  assert.deepEqual(labels("task-runner 와 confidential computing 소개"), []);
  assert.deepEqual(labels("두 안을 적극비교하고 대외비용을 줄인다"), []);
});

test("등록된 민감 단어(광고주명 등): 영문은 단어 단위·대소문자 무시, 한글은 포함", () => {
  assert.deepEqual(envTerms(" Acme , , 가나다전자 "), ["Acme", "가나다전자"]);
  assert.deepEqual(labels("ACME 캠페인 결과", ["Acme"]), ["등록된 민감 단어 'Acme'"]);
  assert.deepEqual(labels("SKILL.md 의 algorithm 과 task", ["SK", "LG"]), []);
  assert.deepEqual(labels("SK 텔레콤 캠페인", ["SK"]), ["등록된 민감 단어 'SK'"]);
  assert.deepEqual(labels("가나다전자의 신제품", ["가나다전자"]), ["등록된 민감 단어 '가나다전자'"]);
});

test("윈도우 한글(EUC-KR)·UTF-16 텍스트와 오피스 문서 속 글자도 검사한다", () => {
  const euckr = new Uint8Array([0xb4, 0xeb, 0xbf, 0xdc, 0xba, 0xf1]); // '대외비' (EUC-KR)
  const utf16 = new Uint8Array([0xff, 0xfe, 0x00, 0xb3, 0x78, 0xc6, 0x44, 0xbe]); // BOM + '대외비' (UTF-16LE)
  const docx = zipSync({ "word/document.xml": strToU8("<w:p><w:r><w:t>대외</w:t></w:r><w:r><w:t>비 자료</w:t></w:r></w:p>") });
  const zip = zipSync({ "notes.txt": euckr, "memo.txt": utf16, "template.docx": docx });
  assert.deepEqual(scan(zipTexts(zip), []).map((f) => f.where).sort(), ["memo.txt", "notes.txt", "template.docx"]);
});

test("zip 안 텍스트 파일만 꺼내 검사한다", () => {
  const zip = zipSync({
    "SKILL.md": strToU8("hello"),
    "scripts/run.py": strToU8("KEY='sk-ant-api03-abcdefghijklmnopqrstuvwx'"),
    "img.png": new Uint8Array([137, 80, 78, 71, 0, 0]),
  });
  const texts = zipTexts(zip);
  assert.deepEqual(Object.keys(texts).sort(), ["SKILL.md", "scripts/run.py"]);
  assert.deepEqual(scan(texts, []), [{ label: "Anthropic API 키", where: "scripts/run.py" }]);
});

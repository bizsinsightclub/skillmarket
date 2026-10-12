import { unzipSync } from "fflate";

// 업로드 민감정보 검사: 개인정보·비밀 키·대외비 표시·광고주명(SENSITIVE_TERMS)이 보이면 올리지 못하게 막는다.
// 이 사이트는 외부 클라우드(Vercel·Supabase)라 광고주·고객 정보는 태그로 가리는 게 아니라 아예 받지 않는다.
// 에디터는 검사를 건너뛴다(잘못 걸린 글을 대신 올려 줄 수 있게).
// ponytail: 정규식·단어 목록 검사라 이미지·PDF 속 글자, 돌려 쓴 표현은 못 잡는다 — 마지막 관문은 에디터 검수.

const RULES: [label: string, re: RegExp][] = [
  ["주민등록번호", /\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-[1-4]\d{6}\b/g],
  ["휴대전화 번호", /\b01[016789][-. ]\d{3,4}[-. ]\d{4}\b/g],
  ["Anthropic API 키", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["OpenAI API 키", /\bsk-(?:proj-)?[A-Za-z0-9]{20,}/g],
  ["AWS 액세스 키", /\bAKIA[0-9A-Z]{16}\b/g],
  ["GitHub 토큰", /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/g],
  ["Slack 토큰", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ["Google API 키", /\bAIza[0-9A-Za-z_-]{35}/g],
  ["개인 키", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["JWT 토큰", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  // '대외 비용', '적극 비교' 같은 붙여 쓴 말은 빼고
  ["대외비 표시", /대외비(?!용)|사외비(?!용)|(?<!적)극비|\bCONFIDENTIAL\b/g],
];

// 예시로 흔히 쓰는 가짜 번호(0000, 1234-5678, 같은 숫자 네 번)는 넘어간다
const DUMMY = /(\d)\1{3}|1234[-. ]5678/;

export function envTerms(raw = process.env.SENSITIVE_TERMS ?? "") {
  return raw.split(",").map((t) => t.trim()).filter((t) => t.length >= 2);
}

// 영문·숫자 단어는 단어 경계로(SK 가 SKILL 에, LG 가 algorithm 에 걸리지 않게), 한글은 포함 여부로
function termRe(term: string) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /^[\x20-\x7e]+$/.test(term) ? new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i") : new RegExp(esc, "i");
}

export type Finding = { label: string; where: string };

// texts = { 위치: 내용 }. 같은 종류는 위치마다 한 번만.
export function scan(texts: Record<string, string>, terms = envTerms()): Finding[] {
  const out: Finding[] = [];
  const termRes = terms.map((t) => [t, termRe(t)] as const);
  for (const [where, text] of Object.entries(texts)) {
    if (!text) continue;
    for (const [label, re] of RULES) {
      const hit = [...text.matchAll(re)].some((m) => !(label === "휴대전화 번호" && DUMMY.test(m[0])));
      if (hit) out.push({ label, where });
    }
    for (const [t, re] of termRes) if (re.test(text)) out.push({ label: `등록된 민감 단어 '${t}'`, where });
  }
  return out;
}

const MAX_TEXT = 5 * 1024 * 1024;

// 텍스트 파일 읽기: UTF-8 → BOM 있는 UTF-16 → EUC-KR(윈도우에서 저장한 한글 파일). 바이너리면 null.
export function decodeText(data: Uint8Array): string | null {
  if (data.length > MAX_TEXT) return null;
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le").decode(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be").decode(data.subarray(2));
  if (data.subarray(0, 8000).includes(0)) return null;
  for (const enc of ["utf-8", "euc-kr"]) {
    try {
      return new TextDecoder(enc, { fatal: true }).decode(data);
    } catch {
      // 다음 인코딩
    }
  }
  return null;
}

// 워드·파워포인트·엑셀 파일 속 글자(XML 에서 태그를 걷어낸 것). 서식 때문에 나뉜 글자도 이어 붙는다.
const OOXML = /\.(docx|pptx|xlsx)$/i;
const OOXML_PARTS = /^(word\/(document|header\d*|footer\d*|footnotes|comments)\.xml|ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml|xl\/(sharedStrings|worksheets\/sheet\d+)\.xml)$/;
function officeText(data: Uint8Array): string | null {
  try {
    const parts = unzipSync(data, { filter: (f) => OOXML_PARTS.test(f.name) && f.originalSize <= MAX_TEXT });
    return Object.values(parts).map((p) => new TextDecoder().decode(p).replace(/<[^>]+>/g, "")).join("\n");
  } catch {
    return null;
  }
}

// zip 안에서 검사할 글자를 꺼낸다: 텍스트 파일 + 오피스 문서. 그 밖의 바이너리(이미지·PDF 등)는 건너뛴다.
export function zipTexts(zip: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, data] of Object.entries(unzipSync(zip))) {
    const text = OOXML.test(path) ? officeText(data) : decodeText(data);
    if (text !== null) out[path] = text;
  }
  return out;
}

export function describe(findings: Finding[]) {
  const list = findings.slice(0, 5).map((f) => `${f.label}(${f.where})`).join(", ");
  return `민감정보로 보이는 내용이 있어 올릴 수 없습니다: ${list}${findings.length > 5 ? ` 외 ${findings.length - 5}건` : ""}. 지우고 다시 올려 주세요. 잘못 걸렸다면 에디터에게 알려 주세요(에디터는 대신 올릴 수 있습니다).`;
}

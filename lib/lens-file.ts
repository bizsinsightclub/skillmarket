import { UploadError } from "./skill-zip.ts";

// The Lens(C:/pjt/magilite) 렌즈 .md 파일. 실제로 쓰이는 건 첫 펜스드 코드블록(시스템 프롬프트)뿐이다
// (magilite app/parsing.py extract_system_prompt 와 같은 규칙). 나머지는 설명 문서.
export const MAX_LENS_BYTES = 200 * 1024;
const REQUIRED = ["# 역할", "# 오퍼레이션", "# 출력 형식"];

export type ParsedLens = {
  title: string; // H1 제목
  name: string; // 이름 기본값: 제목의 "EXPERT-01: 소비트렌드 분석 — …" 에서 가운데 부분
  prompt: string; // 첫 펜스드 코드블록
  preamble: string; // 제목 아래 > 인용 단락 (소개문)
  operations: string[]; // "SIGNAL (신호 채집)" 처럼 단계 이름
};

export function parseLensFile(raw: string): ParsedLens {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const title = text.match(/^#\s+(.+)$/m)?.[1].trim() ?? "";
  const prompt = text.match(/```[^\n]*\n([\s\S]*?)\n```/)?.[1].trim() ?? "";
  if (!prompt) throw new UploadError("렌즈 파일에 시스템 프롬프트 코드블록(```)이 없습니다");
  const missing = REQUIRED.filter((h) => !prompt.split("\n").some((l) => l.startsWith(h)));
  if (missing.length) throw new UploadError(`렌즈 프롬프트에 필요한 절이 없습니다: ${missing.join(", ")}`);
  if (prompt.length < 200 || prompt.length > 12000) throw new UploadError("렌즈 프롬프트는 200~12000자여야 합니다");

  // "# 오퍼레이션" 절의 "1단계 — SIGNAL (신호 채집): …" 줄에서 단계 이름만
  const opSection = prompt.split(/\n(?=# )/).find((s) => s.startsWith("# 오퍼레이션")) ?? "";
  const operations = [...opSection.matchAll(/^\s*\d+\s*단계\s*[—–-]+\s*([^:：\n]+)[:：]/gm)].map((m) => m[1].replace(/\s*\(핵심 단계\)\s*$/, "").trim()).slice(0, 8);

  const preamble = text
    .split("\n")
    .filter((l) => l.startsWith(">"))
    .map((l) => l.replace(/^>\s?/, ""))
    .join("\n")
    .trim();
  const name = (title.split(":").slice(1).join(":") || title).split(/\s+[—–-]\s+/)[0].trim().slice(0, 80);
  return { title, name, prompt, preamble, operations };
}

// 스킬 구조도(archify, https://github.com/tt-a1i/archify) + 작동 원리.
// 그리는 건 이 PC 의 Claude Code 가 archify 스킬로 한다(사용자 선택, 2026-11-21 — API 비용 없이, 브라우저 확인까지).
// 이 파일은 그 앞뒤만: todo = 구조도가 필요한 승인 스킬 zip 을 작업 폴더에 풀기, put = Pretendard 를 넣어 올리고 DB 갱신.
// 매일 13:00 은 scripts/diagram-daily.ps1(작업 스케줄러)이 todo → claude -p(도구 제한) → put 을 돌린다.
// 안전: 스킬 내용은 신뢰하지 않는 자료(프롬프트 인젝션) → 무인 실행은 도구 제한, 스킬 스크립트는 실행하지 않음,
// 결과 HTML 은 격리 iframe(allow-same-origin 없음)으로만 연다.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { unzipSync } from "fflate";
import type { Db } from "./db.ts";
import { download, remove, upload } from "./storage.ts";

const PRETENDARD = () => join(process.cwd(), "node_modules", "pretendard", "dist", "web", "variable");

// 구조도 폰트를 Pretendard 로 통일. 구조도는 격리 iframe(고유 출처 없음)이라 사이트의 폰트 파일을 못 불러온다(로그인 쿠키 X)
// → Pretendard 분할 폰트(92조각) 중 이 HTML 에 실제로 쓰인 글자가 든 조각만 base64 로 넣고, 모든 글꼴 지정을 덮어쓴다.
// archify 는 JetBrains Mono 폭으로 상자를 잡지만 Pretendard 가 더 좁아 글자가 상자를 넘지 않는다.
export async function withPretendard(html: string): Promise<string> {
  if (html.includes("skillmarket-pretendard")) return html; // 이미 적용됨
  const dir = PRETENDARD();
  const css = await readFile(join(dir, "pretendardvariable-dynamic-subset.css"), "utf-8");
  const used = new Set<number>();
  for (const ch of html.replace(/base64,[A-Za-z0-9+/=]+/g, "")) used.add(ch.codePointAt(0)!);
  const faces: string[] = [];
  for (const m of css.matchAll(/url\(\.\/(woff2-dynamic-subset\/[^)]+\.woff2)\)[^;]*;\s*unicode-range:\s*([^;]+);/g)) {
    const ranges = m[2].split(",").map((r) => r.trim().replace(/^U\+/i, "").split("-").map((h) => parseInt(h, 16)));
    const hit = ranges.some(([a, b = a]) => { for (const c of used) if (c >= a && c <= b) return true; return false; });
    if (!hit) continue;
    const b64 = (await readFile(join(dir, m[1]))).toString("base64");
    faces.push(`@font-face{font-family:'Pretendard Variable';font-weight:45 920;font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2-variations');unicode-range:${m[2]};}`);
  }
  const style = `<style id="skillmarket-pretendard">${faces.join("")}
*,html,body,svg,text,tspan,button,input,select,textarea,code,pre{font-family:'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif !important;}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : style + html;
}

// 구조도가 필요한 것: 스킬(zip)의 보여 주는 버전(승인본, 없으면 최신) 중 아직 없는 것. force 면 전부.
export function diagramTodo(db: Db, opts: { force?: boolean; slug?: string } = {}) {
  return db.query<{ version_id: number; slug: string; name: string; summary: string; zip_path: string }>(
    `SELECT v.id AS version_id, s.slug, s.name, COALESCE(s.summary,'') AS summary, v.zip_path
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     JOIN LATERAL (SELECT id, zip_path, diagram_path FROM app.skill_versions WHERE skill_id = s.id
                   ORDER BY (id = s.curated_version_id) DESC, id DESC LIMIT 1) v ON true
     WHERE c.post_type = 'skill' AND s.curated_version_id IS NOT NULL
       ${opts.force ? "" : "AND v.diagram_path IS NULL"} ${opts.slug ? "AND s.slug = $1" : ""}
     ORDER BY s.id`,
    opts.slug ? [opts.slug] : [],
  );
}

// zip 을 작업 폴더에 푼다(글자로 읽기만 — 실행 금지). 서버가 다시 묶은 zip 이지만 경로 탈출은 한 번 더 막는다.
export async function unpackForReading(zip: Uint8Array, dest: string) {
  await rm(dest, { recursive: true, force: true });
  const root = normalize(dest) + sep;
  for (const [name, data] of Object.entries(unzipSync(zip))) {
    if (name.endsWith("/")) continue;
    const out = normalize(join(dest, name));
    if (!out.startsWith(root)) continue; // ../ 등 탈출
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, data);
  }
}

// 그린 구조도·원리를 올린다: Pretendard 넣기 → 새 경로(업로드는 덮어쓰기 안 됨, 캐시된 옛 그림도 안 보이게) → DB → 옛 파일 삭제
export async function putDiagram(db: Db, versionId: number, html: string, principle: string) {
  const [v] = await db.query<{ skill_id: number; diagram_path: string | null }>(
    "SELECT skill_id, diagram_path FROM app.skill_versions WHERE id = $1", [versionId]);
  if (!v) throw new Error(`버전 ${versionId} 없음`);
  if (!/archify|<svg/i.test(html)) throw new Error("archify HTML 이 아닌 것 같습니다");
  const path = `skills/${v.skill_id}/diagram/${versionId}-${Date.now()}.html`;
  await upload(path, new TextEncoder().encode(await withPretendard(html)), "text/plain"); // Storage 주소로 직접 열려도 실행되지 않게
  await db.query("UPDATE app.skill_versions SET diagram_path = $2, principle = $3 WHERE id = $1", [versionId, path, principle.slice(0, 4000)]);
  if (v.diagram_path) await remove([v.diagram_path]);
  return path;
}

export { download };

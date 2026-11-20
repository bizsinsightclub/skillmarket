// NVIDIA skillspector 로 검수 대기 글을 정적 검사해 app.skill_scans 에 기록한다(에디터 PC 에서 실행).
// 서버(Vercel, Node)는 Python 도구를 못 돌리므로 A 방식: 에디터가 `npm run scan` → 검수 대기함 카드에 배지.
//   npm run scan              검수 대기 스킬(zip)의 최신 버전 중 아직 검사 안 한 것
//   npm run scan -- --all     모든 스킬(zip)
//   npm run scan -- --force   이미 검사한 것도 다시
//   npm run scan -- --links   링크형 GitHub 저장소도(시험적). 대부분 스킬이 아닌 앱 전체 저장소라 skillspector 의
//                              git 용량 한도에 걸리거나 앱 코드·문서에서 잡음이 난다(2026-11-20: 22개 중 2개만 결과) → 실패는 기록 안 함.
// 준비: uv tool install --python 3.13 git+https://github.com/NVIDIA/skillspector.git
// --no-llm: 파일 내용을 밖으로 보내지 않는다(의존 패키지 이름만 OSV.dev 조회). 스킬을 실행하지 않는다.
// 렌즈(.md)·HTML 앱은 skillspector 대상(에이전트 스킬)이 아니라 건너뛴다.
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "../lib/db.ts";
import { download } from "../lib/storage.ts";
import { githubRepo } from "../lib/describe.ts";

const all = process.argv.includes("--all");
const force = process.argv.includes("--force");
const links = process.argv.includes("--links");
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL 없음 — npx vercel env pull 로 .env.local 을 받으세요");
const BIN = process.platform === "win32" ? "skillspector.exe" : "skillspector";
const SEV = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

type Issue = { id: string; category: string; severity: string; location?: { file?: string; start_line?: number | null } };
type Report = { risk_assessment: { score: number; recommendation: string }; issues: Issue[]; metadata?: { skillspector_version?: string } };

// exit 0 = ≤50점, 1 = >50점(정상 결과), 2 = 오류
function scan(target: string, cwd: string): Promise<Report | { error: string }> {
  return new Promise((resolve) => {
    execFile(BIN, ["scan", target, "--no-llm", "--format", "json"], { cwd, timeout: 240_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const code = err && "code" in err ? err.code : 0;
      if (code === 2 || (err && !stdout)) return resolve({ error: (stderr || String(err)).trim().split("\n").slice(-2).join(" ").slice(0, 300) });
      try { resolve(JSON.parse(stdout) as Report); } catch { resolve({ error: "JSON 해석 실패" }); }
    });
  });
}

const db = connect(url, { max: 1 });
const work = await mkdtemp(join(tmpdir(), "skillscan-"));
try {
  const rows = await db.query<{ id: number; slug: string; name: string; post_type: string; homepage_url: string | null; version_id: number; zip_path: string }>(
    `SELECT s.id, s.slug, s.name, c.post_type, s.homepage_url, v.id AS version_id, v.zip_path
     FROM app.skills s JOIN app.categories c ON c.slug = s.category
     JOIN LATERAL (SELECT id, zip_path FROM app.skill_versions WHERE skill_id = s.id ORDER BY id DESC LIMIT 1) v ON true
     WHERE c.post_type IN (${links ? "'skill', 'link'" : "'skill'"})
       ${all ? "" : "AND s.curation_status = 'pending'"}
       ${force ? "" : "AND NOT EXISTS (SELECT 1 FROM app.skill_scans sc WHERE sc.version_id = v.id)"}
     ORDER BY s.updated_at`,
  );
  console.log(`[scan] 대상 ${rows.length}개 (${all ? "전체" : "검수 대기"}${links ? "·링크형 포함" : ""}${force ? ", 다시 검사" : ""})`);
  const tally: Record<string, number> = {};
  for (const [n, r] of rows.entries()) {
    let target: string | null = null;
    if (r.post_type === "skill" && r.zip_path) {
      target = join(work, `${r.version_id}.zip`);
      await writeFile(target, await download(r.zip_path));
    } else if (r.post_type === "link") {
      const repo = githubRepo(r.homepage_url ?? "");
      if (repo) target = `https://github.com/${repo}`; // github.com 만(남이 적은 임의 주소를 열지 않게)
    }
    if (!target) { console.log(`  - ${r.name}: 건너뜀(검사할 파일·GitHub 저장소 없음)`); continue; }

    const out = await scan(target, work);
    if ("error" in out && r.post_type === "link") { console.log(`  ${n + 1}/${rows.length} 건너뜀 · ${r.name} — ${out.error}`); continue; } // 링크형 실패는 기록 안 함(대상 아님에 가까움)
    const rec = "error" in out ? "ERROR" : out.risk_assessment.recommendation;
    const score = "error" in out ? -1 : out.risk_assessment.score;
    const findings = "error" in out ? [{ id: "ERROR", category: out.error, severity: "", file: "", line: null }]
      : [...out.issues].sort((a, b) => SEV.indexOf(a.severity) - SEV.indexOf(b.severity)).slice(0, 8)
          .map((i) => ({ id: i.id, category: i.category, severity: i.severity, file: i.location?.file ?? "", line: i.location?.start_line ?? null }));
    await db.query(
      `INSERT INTO app.skill_scans (version_id, score, recommendation, findings, tool_version, scanned_at) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (version_id) DO UPDATE SET score = $2, recommendation = $3, findings = $4, tool_version = $5, scanned_at = now()`,
      [r.version_id, score, rec, JSON.stringify(findings), "error" in out ? "" : out.metadata?.skillspector_version ?? ""],
    );
    tally[rec] = (tally[rec] ?? 0) + 1;
    console.log(`  ${n + 1}/${rows.length} ${rec}${score >= 0 ? ` ${score}` : ""} · ${r.name}${"error" in out ? ` — ${out.error}` : ""}`);
    if (target.startsWith(work)) await rm(target, { force: true });
  }
  console.log("[scan] 끝", tally);
} finally {
  await rm(work, { recursive: true, force: true });
  await db.end();
}

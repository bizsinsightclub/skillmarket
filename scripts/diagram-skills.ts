// 스킬 구조도 작업 도우미 — 그리는 건 Claude Code(archify 스킬), 이건 앞뒤만. 매일 13:00 은 scripts/diagram-daily.ps1 이 부른다.
//   npm run diagram -- todo [--force] [--slug x]   구조도가 필요한 승인 스킬을 .diagram-work/<slug>/files 에 풀고 목록 출력
//   npm run diagram -- put <slug>                  .diagram-work/<slug>/diagram.html + principle.md 를 올림(Pretendard 넣고 DB 갱신)
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { connect } from "../lib/db.ts";
import { diagramTodo, download, putDiagram, unpackForReading } from "../lib/diagram.ts";
import { describe, scan } from "../lib/sensitive.ts";

const WORK = join(process.cwd(), ".diagram-work");
const [cmd, ...rest] = process.argv.slice(2);
const flag = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL 없음 — npx vercel env pull 로 .env.local 을 받으세요");
const db = connect(url, { max: 1 });
try {
  if (cmd === "todo") {
    const rows = await diagramTodo(db, { force: rest.includes("--force"), slug: flag("--slug") });
    for (const r of rows) {
      const dir = join(WORK, r.slug);
      await unpackForReading(await download(r.zip_path), join(dir, "files"));
      await writeFile(join(dir, "meta.json"), JSON.stringify({ version_id: r.version_id, slug: r.slug, name: r.name, summary: r.summary }, null, 2));
    }
    console.log(`구조도 필요 ${rows.length}개`);
    for (const r of rows) { // 무인 실행이 검색 도구 없이 Read 만으로 읽도록 파일 목록을 같이 준다
      const files = await readdir(join(WORK, r.slug, "files"), { recursive: true, withFileTypes: true });
      const list = files.filter((f) => f.isFile()).map((f) => relative(process.cwd(), join(f.parentPath, f.name)).split(sep).join("/"));
      console.log(`\n## ${r.slug}\n${list.map((f) => `- ${f}`).join("\n")}`);
    }
  } else if (cmd === "put") {
    const slug = rest[0];
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("사용법: npm run diagram -- put <slug>");
    const dir = join(WORK, slug);
    const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf-8")) as { version_id: number };
    const html = await readFile(join(dir, "diagram.html"), "utf-8");
    const principle = (await readFile(join(dir, "principle.md"), "utf-8")).trim();
    if (principle.length < 50) throw new Error("principle.md 가 비었거나 너무 짧습니다");
    // 무인 실행이 스킬 속 지시에 속아 비밀값을 원리·명세에 옮겨 적어도 사이트에 올라가지 않게(업로드 민감정보 검사와 같은 규칙)
    const spec = await readFile(join(dir, "spec.json"), "utf-8").catch(() => "");
    const hits = scan({ "작동 원리": principle, "구조도 명세": spec });
    if (hits.length) throw new Error(`올리지 않음 — ${describe(hits)}`);
    console.log("올림:", await putDiagram(db, meta.version_id, html, principle));
  } else if (cmd === "status") {
    const names = await readdir(WORK).catch(() => [] as string[]);
    for (const n of names) {
      const has = async (f: string) => stat(join(WORK, n, f)).then(() => "O", () => "-");
      console.log(`${n}: diagram.html ${await has("diagram.html")} · principle.md ${await has("principle.md")}`);
    }
  } else {
    console.log("사용법: npm run diagram -- todo [--force] [--slug x] | put <slug> | status");
  }
} finally {
  await db.end();
}

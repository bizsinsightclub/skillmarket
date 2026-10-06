// 매일 아침 Gmail 로 오는 "바이브코딩 아침 브리핑" 메일 → 링크형 글로 올리고 검수 대기(pending)로.
// 메일 읽기는 briefing-mail.ts, 이 파일은 본문 해석과 DB 저장(테스트 대상).
import { one, type Db } from "./db.ts";
import { slugify } from "./skill-zip.ts";
import { LINK_VERSION } from "./link-post.ts";

export const BRIEFING_SUBJECT = "바이브코딩 아침 브리핑";
const TAG = "GitHub 트렌딩";

// section = 항목이 속한 "[...]" 묶음 제목. 스킬·플러그인 묶음이면 플러그인, 아니면 오픈소스 분류
export type BriefingItem = { name: string; url: string; maker: string; summary: string; section: string };
const categoryOf = (section: string) => (/플러그인|스킬/.test(section) ? "plugin" : "oss");

const REPO = /https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/;

// HTML 메일이면 글자만 남긴다. 문단(</p>)은 빈 줄, 줄(<br>, </div> — Gmail 은 줄마다 div)은 줄바꿈
export function htmlText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<(br|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

// "[묶음 제목]" 아래 "N. 이름 — 덧말 (별 n개)" 줄 → GitHub 주소 줄 → 설명 줄들.
// 설명 뒤 빈 줄에서 항목이 끝난다(메일 끝 인사말이 설명에 붙지 않게).
export function parseBriefing(text: string): BriefingItem[] {
  const items: BriefingItem[] = [];
  let section = "";
  let cur: { head: string; url: string; maker: string; desc: string[] } | null = null;
  const flush = () => {
    if (cur?.url) {
      const name = cur.head.replace(/^\d{1,2}\.\s*/, "").split(/\s+[—–-]\s+/)[0].replace(/\s*\([^)]*\)\s*$/, "").trim().slice(0, 80);
      items.push({ name: name || cur.url.split("/").pop()!, url: cur.url, maker: cur.maker, summary: cur.desc.join(" ").slice(0, 1000), section });
    }
    cur = null;
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const sec = line.match(/^\[([^\]]{1,80})\]$/);
    if (sec) {
      flush();
      section = sec[1].trim();
    } else if (/^\d{1,2}\.\s+\S/.test(line)) {
      flush();
      cur = { head: line, url: "", maker: "", desc: [] };
    } else if (!cur) {
      continue;
    } else if (/^-{3,}$/.test(line)) {
      flush(); // 구분선 아래는 맺음말
    } else if (!line) {
      if (cur.url && cur.desc.length) flush();
    } else if (!cur.url && REPO.test(line)) {
      const [, owner, repo] = line.match(REPO)!;
      cur.url = `https://github.com/${owner}/${repo.replace(/\.git$/, "")}`;
      cur.maker = owner;
    } else if (cur.url) {
      cur.desc.push(line);
    }
  }
  flush();
  return items;
}

// 이미 있는 글(같은 저장소 주소, 같은 이름, 또는 저장소 이름과 같은 slug)은 건너뛴다. 새로 만든 글의 slug 목록을 돌려준다.
export async function ingestBriefing(db: Db, items: BriefingItem[], owner: { id: number; name: string; email: string }, source: string) {
  const created: string[] = [];
  await db.tx(async (t) => {
    for (const it of items) {
      const dup = await one(
        t,
        "SELECT 1 FROM app.skills WHERE lower(rtrim(homepage_url, '/')) = lower($1) OR lower(name) = lower($2) OR slug = $3",
        [it.url, it.name, slugify(it.url.split("/").pop()!)],
      );
      if (dup) continue;
      const base = slugify(it.name, "oss");
      let slug = base;
      for (let i = 2; await one(t, "SELECT 1 FROM app.skills WHERE slug = $1", [slug]); i++) slug = `${base}-${i}`;
      const from = it.section ? `${source} · ${it.section}` : source;
      const body = `## 소개\n\n${it.summary}\n\n[GitHub 저장소](${it.url})\n\n---\n\n${from} 에서 자동으로 올린 글입니다. 에디터가 확인하고 설치 방법을 보탠 뒤 승인합니다.`;
      const s = (await one<{ id: number }>(
        t,
        `INSERT INTO app.skills (slug, name, summary, body_md, category, tags, author_name, author_email, owner_id, visibility, maker, homepage_url, curation_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'public', $10, $11, 'pending') RETURNING id`,
        [slug, it.name, it.summary.slice(0, 200), body, categoryOf(it.section), TAG, owner.name || owner.email, owner.email, owner.id, it.maker, it.url],
      ))!;
      await t.query("INSERT INTO app.skill_versions (skill_id, version, zip_path, skill_md, uploaded_by, changelog) VALUES ($1, $2, '', '', $3, $4)", [
        s.id, LINK_VERSION, owner.id, "브리핑 자동 등록",
      ]);
      created.push(slug);
    }
  });
  return created;
}

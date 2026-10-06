import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSkill, type Kind } from "@/lib/queries";
import { fitText } from "@/lib/format";

// 이미지를 올리지 않은 글의 썸네일을 입력한 정보(이름·요약·종류·만든 곳/기반·태그)로 그린다.
// URL 에 ?v=<updated_at> 를 붙여 부르므로 글이 바뀌면 새 주소 → 캐시는 길게.
// 숫자(스킬 n개 등)는 넣지 않는다 — 사용자 지시.
const FONT_DIR = join(process.cwd(), "node_modules/pretendard/dist/public/static");
const fonts = Promise.all([readFile(join(FONT_DIR, "Pretendard-ExtraBold.otf")), readFile(join(FONT_DIR, "Pretendard-Medium.otf"))]);

const TONE: Record<Kind, { glow: string; dot: string; chip: string }> = {
  skill: { glow: "rgba(230,245,122,0.22)", dot: "#e6f57a", chip: "rgba(230,245,122,0.14)" },
  link: { glow: "rgba(56,189,248,0.24)", dot: "#7dd3fc", chip: "rgba(56,189,248,0.14)" },
  lens: { glow: "rgba(124,92,252,0.32)", dot: "#a78bfa", chip: "rgba(167,139,250,0.18)" },
};

export async function GET(_req: Request, ctx: RouteContext<"/skills/[slug]/cover">) {
  const { slug } = await ctx.params;
  const { viewer } = await requireViewer();
  const s = await getSkill(getDb(), viewer, { slug });
  if (!s) notFound();
  const [bold, medium] = await fonts;
  const t = TONE[s.post_type];

  const eyebrow = s.post_type === "link" ? `${s.category_label} · by ${s.maker}` : s.post_type === "lens" ? `The Lens 전문가 · ${s.person} 기반` : `Claude 스킬 · ${s.category_label}`;
  const chips = (s.post_type === "lens" ? s.bands.split(",").map((b) => b.replace(/\s*\(.*$/, "")) : s.tags.split(","))
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 4);
  // 칸 높이로 잘라내지 않고, 들어갈 만큼만 문장·어절 단위로 넣는다(중간에서 잘린 채 끝나지 않게)
  const name = fitText(s.name, 40);
  const summary = fitText(s.summary, 84); // 32px 로 약 3줄
  const nameSize = name.length > 24 ? 64 : name.length > 14 ? 76 : name.length > 8 ? 92 : 112;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 84px", color: "#fff", fontFamily: "Pretendard", position: "relative",
          background: `radial-gradient(70% 80% at 88% 8%, ${t.glow}, transparent 70%), linear-gradient(160deg, #18181d, #212129)`,
        }}
      >
        {/* 위 왼쪽은 카드의 '에디터 픽' 배지 자리라 비워 둔다 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.72)" }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: t.dot }} />
            {fitText(eyebrow, 48)}
          </div>
          <div style={{ fontSize: nameSize, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, wordBreak: "keep-all" }}>
            {name}
          </div>
          {summary && (
            <div style={{ marginTop: 26, fontSize: 32, fontWeight: 500, lineHeight: 1.4, color: "rgba(255,255,255,0.78)", wordBreak: "keep-all" }}>
              {summary}
            </div>
          )}
        </div>
        <div style={{ position: "absolute", left: 84, bottom: 64, display: "flex", gap: 12 }}>
          {chips.map((c) => (
            <div key={c} style={{ display: "flex", fontSize: 24, fontWeight: 500, padding: "8px 20px", borderRadius: 999, background: t.chip, border: "1px solid rgba(255,255,255,0.16)" }}>
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1280,
      height: 800,
      fonts: [
        { name: "Pretendard", data: bold, weight: 800, style: "normal" },
        { name: "Pretendard", data: medium, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "private, max-age=31536000, immutable" },
    },
  );
}

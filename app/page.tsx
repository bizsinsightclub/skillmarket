import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { hallOfFame, listBoard, myContribution } from "@/lib/queries";
import { SkillGrid, byline, coverUrl } from "@/components/skill-card";
import PickSpotlight from "@/components/pick-spotlight";

function Section({ title, sub, href, lens = false, children }: { title: string; sub?: string; href: string; lens?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em]">{lens && <span className="h-2.5 w-2.5 rounded-full bg-lens" />}{title}</h2>
          {sub && <p className="mt-1 text-sm text-black/50">{sub}</p>}
        </div>
        <Link href={href} className="glass shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-black/70 hover:text-ink">모두 보기 →</Link>
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const { viewer } = await requireViewer();
  const db = getDb();
  const [mine, fame, picks, trending, latest, plugins, experts] = await Promise.all([
    myContribution(db, viewer.email),
    hallOfFame(db, { days: 30, limit: 5 }),
    // 최근에 에디터 픽으로 고른 순 → 새로 고른 글이 조명 앞쪽에 온다
    listBoard(db, viewer, { tab: "pick", sort: "picked", limit: 12 }),
    listBoard(db, viewer, { kind: "skill", sort: "trending", limit: 8 }),
    listBoard(db, viewer, { kind: "skill", limit: 8 }),
    listBoard(db, viewer, { kind: "link", sort: "popular", limit: 4 }),
    listBoard(db, viewer, { kind: "lens", sort: "popular", limit: 4 }),
  ]);
  const hot = trending.rows.filter((r) => r.trend > 0); // 최근 활동이 있는 것만 (없으면 최신 목록과 똑같아짐)

  return (
    <div>
      {/* 검색은 헤더 하나로. 첫 화면은 소개 한 줄 + 에디터 픽 조명 */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-black/45">사내 Claude 스킬 마켓</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">동료들의 스킬을 함께 쓰고, 함께 키워요</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/write?category=plugin" className="glass rounded-xl px-4 py-2.5 font-bold">플러그인 추천하기</Link>
        </div>
      </div>

      {/* 내 기여 현황: 공유한 것이 쓰이고 있다는 걸 첫 화면에서 보이게 */}
      <div className="glass mb-10 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-3xl px-6 py-5">
        <p className="text-sm font-bold">내 기여</p>
        {mine.skills + mine.waiting === 0 ? (
          <p className="mr-auto text-sm text-black/60">아직 올린 스킬이 없습니다. 동료가 받아 가고 써 보면 여기에 쌓입니다.</p>
        ) : (
          <>
            {[["공개된 내 글", mine.skills], ["받아 간 사람", mine.installs], ["이번 달", mine.month], ["써봤어요", mine.uses]].map(([label, n]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tabular-nums tracking-tight">{label === "이번 달" ? `+${n}` : n}</span>
                <span className="text-xs text-black/50">{label}</span>
              </div>
            ))}
            {mine.waiting > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">검수 대기 {mine.waiting}</span>}
            <Link href={`/u/${encodeURIComponent(viewer.email)}`} className="ml-auto text-sm font-medium text-black/60 hover:text-ink">내 원작자 페이지 →</Link>
          </>
        )}
        {mine.skills + mine.waiting === 0 && <Link href="/write" className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">스킬 올리기</Link>}
      </div>

      {picks.rows.length > 0 && (
        <div className="mb-16">
          <PickSpotlight
            picks={picks.rows.map((r) => ({
              slug: r.slug, name: r.name, summary: r.summary, image: r.thumb ? `/files/${r.thumb}` : coverUrl(r.slug, r.updated_at), category_label: r.category_label,
              byline: byline(r), likes: r.likes, installs: r.post_type === "link" ? null : r.installs,
            }))}
          />
        </div>
      )}

      {hot.length > 0 && (
        <Section title="🔥 요즘 뜨는 스킬" sub="최근 7일 설치·좋아요 기준" href="/skills?sort=trending">
          <SkillGrid rows={hot} />
        </Section>
      )}
      {fame.length > 0 && (
        <Section title="이달의 기여자" sub="최근 30일, 동료가 받아 가고 써본 스킬의 원작자" href="/hall">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {fame.map((f) => (
              <li key={f.author_email}>
                <Link href={`/u/${encodeURIComponent(f.author_email)}`} className="glass flex items-center gap-3 rounded-2xl p-4 hover:-translate-y-0.5 transition">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink font-bold text-accent">{f.author_name[0]}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{f.author_name}</span>
                    <span className="block text-xs text-black/55">받아 감 {f.installs} · 써봤어요 {f.uses}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="새로 올라온 스킬" href="/skills">
        <SkillGrid rows={latest.rows} empty="아직 등록된 스킬이 없습니다. 첫 스킬을 올려 보세요!" />
      </Section>
      {experts.total > 0 && (
        <Section title="전문가 렌즈" sub="The Lens 에서 쓰는 분야별 전문가 관점" href="/experts" lens>
          <SkillGrid rows={experts.rows} />
        </Section>
      )}
      {plugins.total > 0 && (
        <Section title="추천 플러그인·MCP" sub="동료들이 추천하는 Claude Code 플러그인과 MCP 서버" href="/plugins">
          <SkillGrid rows={plugins.rows} />
        </Section>
      )}
    </div>
  );
}

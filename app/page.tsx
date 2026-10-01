import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { listBoard } from "@/lib/queries";
import { SkillGrid } from "@/components/skill-card";

function Section({ title, sub, href, children }: { title: string; sub?: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {sub && <p className="mt-1 text-sm text-black/50">{sub}</p>}
        </div>
        <Link href={href} className="shrink-0 text-sm text-black/60 hover:text-ink">모두 보기 →</Link>
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const { viewer } = await requireViewer();
  const db = getDb();
  const [picks, curated, trending, latest] = await Promise.all([
    listBoard(db, viewer, { tab: "pick", limit: 4 }),
    listBoard(db, viewer, { tab: "curated", sort: "popular", limit: 8 }),
    listBoard(db, viewer, { sort: "trending", limit: 8 }),
    listBoard(db, viewer, { limit: 8 }),
  ]);
  const hot = trending.rows.filter((r) => r.trend > 0); // 최근 활동이 있는 것만 (없으면 최신 목록과 똑같아짐)

  return (
    <div>
      <div className="mb-14 rounded-3xl bg-ink px-8 py-12 text-white sm:px-12">
        <p className="text-sm font-semibold text-accent">사내 Claude 스킬 마켓</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          동료가 만든 스킬을 찾아 쓰고,<br />내가 만든 스킬을 나누세요
        </h1>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/skills" className="rounded-full bg-accent px-5 py-2.5 font-semibold text-ink">스킬 둘러보기</Link>
          <Link href="/write" className="rounded-full px-5 py-2.5 font-semibold ring-1 ring-white/30 hover:bg-white/10">스킬 올리기</Link>
        </div>
      </div>

      {picks.total > 0 && (
        <Section title="에디터 픽" sub="에디터가 직접 써 보고 고른 스킬" href="/skills?tab=pick">
          <SkillGrid rows={picks.rows} />
        </Section>
      )}
      {curated.total > 0 && (
        <Section title="큐레이티드" sub="검수를 통과한 스킬" href="/skills?tab=curated&sort=popular">
          <SkillGrid rows={curated.rows} />
        </Section>
      )}
      {hot.length > 0 && (
        <Section title="🔥 요즘 뜨는 스킬" sub="최근 7일 설치·좋아요 기준" href="/skills?sort=trending">
          <SkillGrid rows={hot} />
        </Section>
      )}
      <Section title="새로 올라온 스킬" href="/skills">
        <SkillGrid rows={latest.rows} empty="아직 등록된 스킬이 없습니다. 첫 스킬을 올려 보세요!" />
      </Section>
    </div>
  );
}

import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/auth";
import { listBoard } from "@/lib/queries";
import { SkillGrid } from "@/components/skill-card";
import PickSpotlight from "@/components/pick-spotlight";

function Section({ title, sub, href, children }: { title: string; sub?: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{title}</h2>
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
  const [picks, curated, trending, latest] = await Promise.all([
    listBoard(db, viewer, { tab: "pick", sort: "popular", limit: 12 }),
    listBoard(db, viewer, { tab: "curated", sort: "popular", limit: 8 }),
    listBoard(db, viewer, { sort: "trending", limit: 8 }),
    listBoard(db, viewer, { limit: 8 }),
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
          <Link href="/write" className="rounded-xl bg-ink px-4 py-2.5 font-bold text-white hover:bg-black">스킬 올리기</Link>
          <Link href="/write?category=plugin" className="glass rounded-xl px-4 py-2.5 font-bold">플러그인 추천하기</Link>
        </div>
      </div>

      {picks.rows.length > 0 && (
        <div className="mb-16">
          <PickSpotlight
            picks={picks.rows.map((r) => ({
              slug: r.slug, name: r.name, summary: r.summary, thumb: r.thumb, category_label: r.category_label,
              maker: r.maker, author_name: r.author_name, likes: r.likes, installs: r.installs,
            }))}
          />
        </div>
      )}

      {curated.total > 0 && (
        <Section title="큐레이티드" sub="검수를 통과한 스킬·플러그인" href="/skills?tab=curated&sort=popular">
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

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
    listBoard(db, viewer, { tab: "pick", limit: 4 }),
    listBoard(db, viewer, { tab: "curated", sort: "popular", limit: 8 }),
    listBoard(db, viewer, { sort: "trending", limit: 8 }),
    listBoard(db, viewer, { limit: 8 }),
  ]);
  const hot = trending.rows.filter((r) => r.trend > 0); // 최근 활동이 있는 것만 (없으면 최신 목록과 똑같아짐)

  return (
    <div>
      {/* 원칙 7: 큰 제목 + 가운데 유리 검색 (Raycast Store). 뒤의 색 덩어리가 유리를 살린다 */}
      <section className="relative isolate mb-16 overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:py-20">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_20%_20%,#d9f25a_0%,transparent_60%),radial-gradient(50%_70%_at_80%_30%,#7cc4ff_0%,transparent_60%),radial-gradient(60%_70%_at_60%_100%,#b69cff_0%,transparent_60%),linear-gradient(135deg,#1b1b22,#2a2440)]" />
        <p className="text-sm font-semibold text-accent">사내 Claude 스킬 마켓</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-[-0.03em] text-white sm:text-6xl">
          동료가 만든 스킬,<br />바로 가져다 쓰세요
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-white/75">결과물 미리보기로 고르고, 명령 한 줄로 설치합니다. 내가 만든 스킬도 올려 나눠 보세요.</p>
        <form action="/skills" className="glass mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-2xl p-2">
          <input name="q" placeholder="회의록, 보고서 덱, 랜딩 페이지…" className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-base outline-none placeholder:text-black/45" />
          <button className="shrink-0 rounded-xl bg-ink px-5 py-3 font-bold text-white">검색</button>
        </form>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link href="/skills" className="rounded-xl bg-accent px-5 py-2.5 font-bold text-ink">전체 둘러보기</Link>
          <Link href="/write" className="rounded-xl bg-white/10 px-5 py-2.5 font-bold text-white ring-1 ring-white/25 hover:bg-white/20">스킬 올리기</Link>
        </div>
      </section>

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

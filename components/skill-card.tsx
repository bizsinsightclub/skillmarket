import Link from "next/link";
import type { BoardRow } from "@/lib/queries";

// 카드·조명에 쓰는 한 줄 크레딧. 플러그인은 만든 곳+추천인, 렌즈는 '○○ 기반'(방법론 출처 표기)
export function byline(s: Pick<BoardRow, "post_type" | "maker" | "author_name" | "basis">) {
  if (s.post_type === "link") return `by ${s.maker} · 추천 ${s.author_name}`;
  if (s.post_type === "lens") return `${s.basis} 기반`;
  return `by ${s.author_name}`;
}

// 이미지가 없는 스킬도 카드가 비어 보이지 않게: slug 로 정해지는 색 + 이름으로 표지를 만든다
export function Cover({ slug, name, category }: { slug: string; name: string; category: string }) {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div
      className="flex h-full w-full flex-col justify-center px-6 text-white"
      style={{
        background: `radial-gradient(80% 90% at 85% 15%, hsl(${(h + 60) % 360} 40% 60% / 0.18), transparent 65%), linear-gradient(135deg, hsl(${h} 28% 28%), hsl(${(h + 30) % 360} 25% 17%))`,
      }}
    >
      {/* 위 왼쪽은 배지, 아래 오른쪽은 숫자 자리 → 가운데에 둔다 */}
      <span className="text-xs font-semibold tracking-wide opacity-60">{category}</span>
      <span className="mt-1 line-clamp-2 break-all text-2xl font-extrabold leading-tight tracking-[-0.02em]">{name}</span>
    </div>
  );
}

export function Thumb({ path, slug, name, category, className = "" }: { path: string | null; slug: string; name: string; category: string; className?: string }) {
  return (
    <div className={`overflow-hidden bg-black/5 ${className}`}>
      {path ? (
        <img src={`/files/${path}`} alt={`${name} 결과물 미리보기`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      ) : (
        <Cover slug={slug} name={name} category={category} />
      )}
    </div>
  );
}

export default function SkillCard({ s }: { s: BoardRow }) {
  return (
    // 원칙 5: 이미지가 주인공, 메타는 이미지 밖. 호버는 transform 만 (블러 애니메이션 금지)
    <Link href={`/skills/${s.slug}`} className="group block min-w-0 transition duration-300 hover:-translate-y-1">
      <div className="relative">
        <Thumb
          path={s.thumb}
          slug={s.slug}
          name={s.name}
          category={s.category_label}
          className="aspect-[16/10] rounded-2xl shadow-[0_12px_30px_-18px_rgb(20_20_40/0.45)] ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-[0_20px_40px_-18px_rgb(20_20_40/0.55)]"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {s.picked ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-ink shadow-sm">✦ 에디터 픽</span> : null}
          {s.visibility === "restricted" && <span className="glass-dark rounded-full px-2.5 py-0.5 text-xs font-medium">비공개</span>}
        </div>
        {/* 원칙 6: 이미지 위 수치는 어두운 유리 칩 */}
        <div className="glass-dark absolute bottom-3 right-3 flex gap-2.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
          {s.post_type !== "link" && <span>↓ {s.installs}</span>/* 링크형(플러그인·MCP)은 내려받기가 없다 */}
          <span>♥ {s.likes}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 px-0.5">
        <h3 className="truncate font-bold tracking-[-0.01em] group-hover:underline">{s.name}</h3>
        <span className="shrink-0 text-xs font-medium text-black/45">{s.category_label}</span>
      </div>
      <p className="mt-0.5 truncate px-0.5 text-sm text-black/55">{s.summary || " "}</p>
      <p className="mt-1 truncate px-0.5 text-xs text-black/45">{byline(s)}</p>
    </Link>
  );
}

export function SkillGrid({ rows, empty = "아직 등록된 스킬이 없습니다" }: { rows: BoardRow[]; empty?: string }) {
  if (!rows.length) return <p className="glass rounded-2xl py-20 text-center text-black/50">{empty}</p>;
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => <SkillCard key={r.id} s={r} />)}
    </div>
  );
}

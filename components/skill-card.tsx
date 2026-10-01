import Link from "next/link";
import type { BoardRow } from "@/lib/queries";

// 이미지가 없는 스킬도 카드가 비어 보이지 않게: slug 로 정해지는 색 + 이름으로 표지를 만든다
export function Cover({ slug, name, category }: { slug: string; name: string; category: string }) {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div
      className="flex h-full w-full flex-col justify-center px-6 text-white"
      style={{ background: `linear-gradient(135deg, hsl(${h} 45% 32%), hsl(${(h + 50) % 360} 55% 18%))` }}
    >
      {/* 위 왼쪽은 배지, 아래 오른쪽은 숫자 자리 → 가운데에 둔다 */}
      <span className="text-xs font-medium tracking-wide opacity-60">{category}</span>
      <span className="mt-1 line-clamp-2 break-all text-2xl font-bold leading-tight">{name}</span>
    </div>
  );
}

export function Thumb({ path, slug, name, category, className = "" }: { path: string | null; slug: string; name: string; category: string; className?: string }) {
  return (
    <div className={`overflow-hidden bg-black/5 ${className}`}>
      {path ? (
        <img src={`/files/${path}`} alt={`${name} 결과물 미리보기`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      ) : (
        <Cover slug={slug} name={name} category={category} />
      )}
    </div>
  );
}

export default function SkillCard({ s }: { s: BoardRow }) {
  return (
    <Link href={`/skills/${s.slug}`} className="group block min-w-0">
      <div className="relative">
        <Thumb path={s.thumb} slug={s.slug} name={s.name} category={s.category_label} className="aspect-[16/10] rounded-2xl ring-1 ring-black/5" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {s.editor_pick ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-ink">에디터 픽</span> : null}
          {s.curated && !s.editor_pick ? <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink">검수 완료</span> : null}
          {s.visibility === "restricted" && <span className="rounded-full bg-ink/80 px-2.5 py-0.5 text-xs text-white">비공개</span>}
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1.5 text-xs font-medium text-white">
          <span className="rounded-full bg-black/55 px-2 py-0.5 backdrop-blur">↓ {s.installs}</span>
          <span className="rounded-full bg-black/55 px-2 py-0.5 backdrop-blur">♥ {s.likes}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="truncate font-semibold group-hover:underline">{s.name}</h3>
        <span className="shrink-0 text-xs text-black/45">{s.category_label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm text-black/55">{s.summary || " "}</p>
      <p className="mt-1 text-xs text-black/45">by {s.author_name}</p>
    </Link>
  );
}

export function SkillGrid({ rows, empty = "아직 등록된 스킬이 없습니다" }: { rows: BoardRow[]; empty?: string }) {
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-black/15 py-20 text-center text-black/45">{empty}</p>;
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => <SkillCard key={r.id} s={r} />)}
    </div>
  );
}

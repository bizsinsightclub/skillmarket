import Link from "next/link";

// 전문가 탭 상단: The Lens(C:/pjt/magilite) 소개 + 소개 영상. 사실 근거는 magilite README·CLAUDE.md.
// 색은 The Lens 브랜드(라일락 + 퍼플)로 다른 탭(라임)과 구분한다.
// 영상은 Storage uploads/site/ 에 있고 /media/[name] 이 로그인 확인 후 넘긴다(공개 저장소에 넣지 않음).
export default function TheLensIntro() {
  return (
    <section className="relative isolate mb-12 overflow-hidden rounded-[2rem] bg-[radial-gradient(60%_80%_at_95%_0%,rgb(167_139_250/0.35),transparent_70%),radial-gradient(50%_70%_at_0%_100%,rgb(124_92_252/0.18),transparent_70%),linear-gradient(135deg,#f3eefd,#e6dcfd)] p-5 text-lens-ink ring-1 ring-lens-2/30 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div className="px-1">
          <p className="flex items-center gap-2 text-sm font-bold text-lens-deep">
            <span className="h-2 w-2 rounded-full bg-lens" />The Lens · 다각 관점 분석
          </p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">한 가지 현상을,<br />여러 전문가의 눈으로</h2>
          <p className="mt-4 leading-relaxed text-lens-ink/75">
            The Lens 는 하나의 현상을 전문가·학문 렌즈·기획 메서드 가운데 1~5개 관점이 각자의 분석 절차로 해석하고,
            서로의 주장을 반박하는 교차 토론을 거쳐 하나의 종합 의견서로 정리하는 사내 분석 도구입니다.
          </p>
          <ol className="mt-6 grid gap-2 text-sm">
            {[
              ["관점 고르기", "전문가 8 · 학문 렌즈 5 · 메서드 11 중 1~5개"],
              ["분석과 교차 토론", "관점마다 자기 절차로 판정하고, 다른 관점의 주장에 반박"],
              ["종합 의견서", "쟁점별 승패와 한 줄 결론으로 정리"],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-xl bg-white/70 px-4 py-3 ring-1 ring-white">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lens text-xs font-bold text-white">{i + 1}</span>
                <span><b className="font-semibold">{t}</b><span className="text-lens-ink/60"> — {d}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm leading-relaxed text-lens-ink/60">
            이 탭에서는 The Lens 의 <b className="text-lens-ink/85">전문가 렌즈(.md)</b>를 올리고 내려받습니다. 렌즈는 실존 인물의 공개된 방법론을 분석 기준으로 삼으며,
            인물을 흉내 내거나 그 사람의 견해를 대변하지 않습니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <Link href="/write?category=expert" className="rounded-xl bg-lens px-5 py-2.5 font-bold text-white hover:bg-lens-deep">렌즈 올리기</Link>
          </div>
        </div>

        <figure className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_-24px_rgb(91_63_214/0.45)] ring-1 ring-white">
          {/* 소리가 있는 영상이라 자동 재생하지 않는다. 받는 양을 줄이려고 재생 전엔 메타데이터만 */}
          <video controls playsInline preload="metadata" poster="/media/the-lens-intro-poster.jpg" className="aspect-video w-full bg-black">
            <source src="/media/the-lens-intro.mp4" type="video/mp4" />
          </video>
          <figcaption className="px-4 py-2 text-xs text-lens-ink/55">The Lens 소개 영상 · 52초</figcaption>
        </figure>
      </div>
    </section>
  );
}

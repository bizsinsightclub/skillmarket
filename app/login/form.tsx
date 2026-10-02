"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/actions";
import CheilLogo from "@/components/cheil-logo";

// 사이트와 같은 톤: 왼쪽 어두운 브랜드 패널(홈 조명과 같은 바탕) + 오른쪽 유리 카드.
// 세 갈래 소개는 헤더 메뉴 색(스킬 라임 · 플러그인 하늘 · 전문가 퍼플)을 그대로 쓴다.
const FEATURES = [
  { dot: "bg-accent", title: "스킬", desc: "동료가 만든 Claude 스킬을 결과물로 보고 고르기" },
  { dot: "bg-sky-400", title: "플러그인·MCP", desc: "써 본 사람이 추천하는 플러그인과 설치법" },
  { dot: "bg-lens-2", title: "전문가", desc: "The Lens 에서 쓰는 분야별 전문가 렌즈" },
];

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email" });
  const codeStep = state.step === "code";
  const input = "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base outline-none placeholder:text-black/40 focus:border-black/40 focus:ring-2 focus:ring-accent";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-6 break-keep lg:grid-cols-[1.1fr_1fr]">
      {/* 브랜드 패널 */}
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[radial-gradient(60%_70%_at_10%_0%,rgb(230_245_122/0.12),transparent_70%),radial-gradient(50%_60%_at_100%_100%,rgb(124_92_252/0.16),transparent_70%),linear-gradient(160deg,#1a1a1f,#202027)] p-8 text-white sm:p-12">
        <div className="flex items-center gap-3 text-xl font-extrabold tracking-tight">
          <CheilLogo className="h-6 w-auto" />
          <span aria-hidden className="h-5 w-px bg-white/30" />
          스킬마켓
        </div>
        <h1 className="mt-14 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
          동료들의 스킬을<br />함께 쓰고, 함께 키워요
        </h1>
        <p className="mt-5 max-w-md leading-relaxed text-white/65">
          결과물 미리보기로 맞는 스킬을 찾고, 명령 한 줄로 설치하세요. 내가 만든 스킬도 원작자 이름과 함께 나눌 수 있어요.
        </p>
        <ul className="mt-10 grid gap-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${f.dot}`} />
              <span><b className="font-semibold">{f.title}</b><span className="text-white/60"> — {f.desc}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {/* 로그인 카드 */}
      <section className="glass order-first mx-auto w-full max-w-md rounded-[2rem] p-8 sm:p-10 lg:order-none">{/* 휴대폰에선 로그인 카드가 먼저 */}
        <ol className="mb-8 flex items-center gap-2 text-xs font-semibold">
          {["사내 메일", "인증 코드"].map((s, i) => {
            const active = i === (codeStep ? 1 : 0);
            const done = codeStep && i === 0;
            return (
              <li key={s} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="h-px w-6 bg-black/15" />}
                <span className={`grid h-6 w-6 place-items-center rounded-full ${active ? "bg-ink text-white" : done ? "bg-accent text-ink" : "bg-black/5 text-black/40"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={active ? "text-ink" : "text-black/40"}>{s}</span>
              </li>
            );
          })}
        </ol>

        <h2 className="text-2xl font-extrabold tracking-[-0.03em]">{codeStep ? "메일로 받은 코드를 입력하세요" : "로그인 / 가입"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-black/55">
          {codeStep ? (
            <><b className="text-ink">{state.email}</b> 로 6자리 코드를 보냈어요. 10분 안에 입력하세요.</>
          ) : (
            <>samsung.com · cheil.com 메일로 받은 6자리 코드로 로그인해요. 처음이면 자동으로 가입됩니다.</>
          )}
        </p>

        <form action={action} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <input
            name="email"
            type="email"
            aria-label="사내 메일"
            placeholder="name@samsung.com"
            defaultValue={state.email}
            readOnly={codeStep}
            required
            autoFocus={!codeStep}
            className={`${input} read-only:bg-black/[.04] read-only:text-black/60`}
          />
          {codeStep && (
            <input
              key="code"
              name="code"
              aria-label="인증 코드"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
              autoComplete="one-time-code"
              className={`${input} text-center text-2xl font-bold tracking-[0.5em]`}
            />
          )}
          {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <button disabled={pending} className="mt-1 rounded-xl bg-ink px-5 py-3 text-base font-bold text-white hover:bg-black disabled:opacity-50">
            {pending ? "확인하는 중…" : codeStep ? "로그인" : "코드 받기"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-black/45">
          {codeStep
            ? "메일이 안 오면 스팸함을 확인하세요. 다른 메일로 하려면 페이지를 새로고침하세요."
            : "사내 메일 주소로만 가입할 수 있어요. 비밀번호는 쓰지 않습니다."}
        </p>
      </section>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email" });
  const codeStep = state.step === "code";

  return (
    <div className="glass mx-auto mt-16 max-w-md rounded-3xl p-8">
      <h1 className="mb-2 text-3xl font-extrabold tracking-[-0.03em]">로그인 / 가입</h1>
      <p className="mb-6 text-sm text-black/60">
        samsung.com · cheil.com 메일로 받은 6자리 코드로 로그인합니다. 처음이면 자동으로 가입됩니다.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          name="email"
          type="email"
          placeholder="name@samsung.com"
          defaultValue={state.email}
          readOnly={codeStep}
          required
          autoFocus={!codeStep}
          className="rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30 read-only:bg-black/5"
        />
        {codeStep && (
          <input
            key="code"
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="메일로 받은 6자리 코드"
            required
            autoFocus
            autoComplete="one-time-code"
            className="rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30 tracking-widest"
          />
        )}
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="rounded-xl bg-ink px-5 py-2.5 font-bold text-white disabled:opacity-50">
          {codeStep ? "로그인" : "코드 받기"}
        </button>
      </form>
      {codeStep && (
        <p className="mt-4 text-xs text-black/50">
          메일이 안 오면 스팸함을 확인하세요. 다른 메일로 하려면 페이지를 새로고침하세요.
        </p>
      )}
    </div>
  );
}

"use client";

import { useFormStatus } from "react-dom";

// 서버 액션 폼의 제출 버튼: 처리 중엔 문구를 바꾸고 막는다(눌렸는지 안 눌렸는지 헷갈리지 않게)
export default function SubmitButton({ children, busy, className }: { children: React.ReactNode; busy: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? busy : children}
    </button>
  );
}

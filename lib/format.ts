// timestamptz → 한국 시간으로 표시
export function fmtDate(d: Date, withTime = false) {
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

// 표지처럼 칸이 정해진 곳에 넣을 글: 문장 단위로 max 자까지 채운다.
// 첫 문장부터 넘치면 어절에서 끊고 "…" — 글자·줄 중간에서 잘린 채 끝나지 않게.
export function fitText(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  let out = "";
  for (const s of t.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? []) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim()) return out.trim();
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,·:;—-]+$/, "") + "…";
}

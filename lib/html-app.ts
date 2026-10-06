import { UploadError } from "./skill-zip.ts";

// HTML 앱 글(post_type 'app'): HTML 파일 하나가 결과물. 함수가 격리 헤더를 붙여 직접 응답하므로 Vercel 응답 한도(4.5MB) 아래.
export const MAX_APP_BYTES = 4 * 1024 * 1024;

// 이 iframe·응답에 주는 권한. allow-same-origin 은 절대 넣지 않는다 → 고유 출처가 없어 사이트 쿠키·저장소·부모 창에 닿지 못한다.
// 대시보드·도구가 흔히 쓰는 폼·알림창·새 창·파일 내려받기는 허용.
export const APP_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-downloads";

const LOOKS_HTML = /<(!doctype\s+html|html|head|body|main|div|section|script|style|canvas|svg|table)\b/i;

export function parseHtmlApp(data: Uint8Array): { text: string; title: string } {
  if (!data.length) throw new UploadError("빈 파일입니다");
  if (data.length > MAX_APP_BYTES) throw new UploadError("HTML 파일은 4MB 이하만 올릴 수 있습니다 (이미지는 파일 안에 넣지 말고 링크로)");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new UploadError("HTML 파일은 UTF-8 로 저장해서 올려 주세요");
  }
  if (!LOOKS_HTML.test(text)) throw new UploadError("HTML 파일이 아닌 것 같습니다");
  const raw = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = raw
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim().slice(0, 80);
  return { text, title };
}

// 격리된 화면(고유 출처 없음)에선 localStorage·sessionStorage 에 닿는 순간 SecurityError → 이것만 쓰는 앱은 아예 안 뜬다.
// 그럴 때만 메모리 저장소로 바꿔 끼운다(새로고침하면 사라짐). <head> 바로 뒤(없으면 doctype 뒤)에 넣어 앱 스크립트보다 먼저 돈다.
const STORAGE_SHIM = `<script>(function(){function m(){var s=new Map();return{get length(){return s.size},key:function(i){var k=Array.from(s.keys())[i];return k===undefined?null:k},getItem:function(k){k=String(k);return s.has(k)?s.get(k):null},setItem:function(k,v){s.set(String(k),String(v))},removeItem:function(k){s.delete(String(k))},clear:function(){s.clear()}}}["localStorage","sessionStorage"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}})})();</script>`;

export function withStorageShim(html: string) {
  const at = html.match(/<head(\s[^>]*)?>/i) ?? html.match(/<!doctype[^>]*>/i);
  if (!at || at.index === undefined) return STORAGE_SHIM + html;
  const i = at.index + at[0].length;
  return html.slice(0, i) + STORAGE_SHIM + html.slice(i);
}

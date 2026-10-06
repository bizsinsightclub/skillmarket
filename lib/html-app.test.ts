import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtmlApp, MAX_APP_BYTES, APP_SANDBOX, withStorageShim } from "./html-app.ts";
import { UploadError } from "./skill-zip.ts";

const enc = (s: string) => new TextEncoder().encode(s);

test("HTML 앱: 제목 추출, HTML 아님·빈 파일·UTF-8 아님·4MB 초과는 거부", () => {
  assert.equal(parseHtmlApp(enc("<!doctype html><title> 매출 &amp; 비용\n대시보드 </title><div id=app></div>")).title, "매출 & 비용 대시보드");
  assert.equal(parseHtmlApp(enc("<div>제목 없음</div>")).title, "");
  assert.throws(() => parseHtmlApp(enc("그냥 글자")), /HTML 파일이 아닌/);
  assert.throws(() => parseHtmlApp(new Uint8Array()), UploadError);
  assert.throws(() => parseHtmlApp(new Uint8Array([0x3c, 0x64, 0x69, 0x76, 0x3e, 0xc7, 0xd1])), /UTF-8/); // EUC-KR '한'
  assert.throws(() => parseHtmlApp(new Uint8Array(MAX_APP_BYTES + 1).fill(0x3c)), /4MB/);
});

test("HTML 앱 격리: 같은 출처 권한은 절대 주지 않는다", () => {
  assert.doesNotMatch(APP_SANDBOX, /allow-same-origin|allow-top-navigation|allow-popups-to-escape-sandbox/);
  assert.match(APP_SANDBOX, /allow-scripts/);
});

test("저장소 대체 코드: <head> 뒤 → 없으면 doctype 뒤 → 없으면 맨 앞(doctype 앞에 끼면 표준 모드가 깨진다)", () => {
  const a = withStorageShim("<!DOCTYPE html><html><head><title>t</title></head></html>");
  assert.match(a, /^<!DOCTYPE html><html><head><script>/);
  assert.match(withStorageShim("<!doctype html><body>x</body>"), /^<!doctype html><script>/);
  assert.match(withStorageShim("<div>x</div>"), /^<script>[\s\S]*<\/script><div>x<\/div>$/);
  assert.match(withStorageShim("<header>머리</header>"), /^<script>/); // <header> 는 <head> 가 아니다
});

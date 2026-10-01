import { test } from "node:test";
import assert from "node:assert/strict";
import { sign, verify, safeEqual, makeSessionToken, readSessionToken } from "./sign.ts";

test("서명 검증: 원본만 통과, 변조·다른 키·빈 값은 거부", () => {
  const t = sign("editor:123", "k1");
  assert.equal(verify(t, "k1"), "editor:123");
  assert.equal(verify(t, "k2"), null);
  assert.equal(verify(t.replace("123", "999"), "k1"), null);
  assert.equal(verify(t + "x", "k1"), null);
  assert.equal(verify(undefined, "k1"), null);
  assert.equal(verify("nodot", "k1"), null);
});

test("세션 토큰: 만료 전만 유효, 형식 다르면 거부", () => {
  const t = makeSessionToken(42, "k", 1000, 0);
  assert.equal(readSessionToken(t, "k", 999), 42);
  assert.equal(readSessionToken(t, "k", 1000), null);
  assert.equal(readSessionToken(t, "other", 0), null);
  assert.equal(readSessionToken(sign("editor:9999999999999", "k"), "k", 0), null);
});

test("safeEqual", () => {
  assert.equal(safeEqual("pw", "pw"), true);
  assert.equal(safeEqual("pw", "pw2"), false);
});

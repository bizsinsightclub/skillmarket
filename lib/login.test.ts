import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import { normalizeEmail, issueCode, verifyCode, safeNext, MAX_ATTEMPTS, CODE_TTL_MS, MAX_FAILS_PER_DAY, MAX_SENDS_PER_IP_HOUR } from "./login.ts";

const D = ["samsung.com", "cheil.com"];

test("도메인: @ 뒤가 정확히 일치할 때만 허용", () => {
  assert.equal(normalizeEmail("  Hong.GilDong@Samsung.com ", D), "hong.gildong@samsung.com");
  assert.equal(normalizeEmail("a@cheil.com", D), "a@cheil.com");
  for (const bad of ["a@xsamsung.com", "a@samsung.com.evil.io", "a@mail.samsung.com", "a@gmail.com", "samsung.com", "a@b@samsung.com", ""]) {
    assert.equal(normalizeEmail(bad, D), null, bad);
  }
});

test("코드: 맞으면 가입+로그인, 1회용", async () => {
  const db = await testDb();
  const code = (await issueCode(db, "a@samsung.com", "k", 0))!;
  assert.match(code, /^\d{6}$/);
  const id = await verifyCode(db, "a@samsung.com", code, "k", 1);
  assert.equal(typeof id, "number");
  assert.equal(await verifyCode(db, "a@samsung.com", code, "k", 2), null); // 재사용 불가
  const code2 = (await issueCode(db, "a@samsung.com", "k", 3))!;
  assert.equal(await verifyCode(db, "a@samsung.com", code2, "k", 4), id); // 같은 사용자
});

test("코드: 만료·다른 이메일·시도 초과는 거부", async () => {
  const db = await testDb();
  const code = (await issueCode(db, "a@samsung.com", "k", 0))!;
  assert.equal(await verifyCode(db, "b@samsung.com", code, "k", 1), null);
  assert.equal(await verifyCode(db, "a@samsung.com", code, "k", CODE_TTL_MS), null);

  const code2 = (await issueCode(db, "c@samsung.com", "k", 0))!;
  const wrong = code2 === "000000" ? "000001" : "000000";
  for (let i = 0; i < MAX_ATTEMPTS; i++) assert.equal(await verifyCode(db, "c@samsung.com", wrong, "k", 1), null);
  assert.equal(await verifyCode(db, "c@samsung.com", code2, "k", 1), null); // 맞는 코드여도 잠김
});

test("코드: 이전 코드는 새 코드 발급 후 무효, 발송 한도", async () => {
  const db = await testDb();
  const old = (await issueCode(db, "a@samsung.com", "k", 0))!;
  const fresh = (await issueCode(db, "a@samsung.com", "k", 1))!;
  if (old !== fresh) assert.equal(await verifyCode(db, "a@samsung.com", old, "k", 2), null);
  await issueCode(db, "a@samsung.com", "k", 2);
  assert.equal(await issueCode(db, "a@samsung.com", "k", 3), null); // 10분에 3통
  assert.notEqual(await issueCode(db, "a@samsung.com", "k", CODE_TTL_MS + 1), null);
});

test("무작위 대입: 하루 틀린 코드가 한도에 닿으면 새 코드를 주지 않는다", async () => {
  const db = await testDb();
  let now = 0;
  let fails = 0;
  while (fails < MAX_FAILS_PER_DAY) {
    const code = (await issueCode(db, "v@samsung.com", "k", now))!;
    const wrong = code === "000000" ? "000001" : "000000";
    for (let i = 0; i < MAX_ATTEMPTS && fails < MAX_FAILS_PER_DAY; i++, fails++) await verifyCode(db, "v@samsung.com", wrong, "k", now);
    now += CODE_TTL_MS + 1; // 10분 창 한도는 비켜 간다
  }
  assert.equal(await issueCode(db, "v@samsung.com", "k", now), null);
  assert.notEqual(await issueCode(db, "v@samsung.com", "k", now + 24 * 60 * 60 * 1000), null); // 다음 날 풀림
});

test("메일 폭탄: 같은 IP 는 주소를 바꿔도 시간당 한도", async () => {
  const db = await testDb();
  for (let i = 0; i < MAX_SENDS_PER_IP_HOUR; i++) assert.notEqual(await issueCode(db, `u${i}@samsung.com`, "k", 0, "1.2.3.4"), null);
  assert.equal(await issueCode(db, "z@samsung.com", "k", 1, "1.2.3.4"), null);
  assert.notEqual(await issueCode(db, "z@samsung.com", "k", 1, "5.6.7.8"), null);
});

test("로그인 후 이동: 같은 사이트 경로만", () => {
  assert.equal(safeNext("/skills?q=a#x"), "/skills?q=a#x");
  for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)", ""]) {
    assert.equal(safeNext(bad), "/", JSON.stringify(bad));
  }
});

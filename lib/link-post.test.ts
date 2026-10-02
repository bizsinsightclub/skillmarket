import { test } from "node:test";
import assert from "node:assert/strict";
import { readLinkFields } from "./link-post.ts";
import { UploadError } from "./skill-zip.ts";

const ok = { maker: " Anthropic ", install_cmd: "/plugin install x@y", homepage_url: "https://github.com/a/b" };

test("링크형 글: 정상 입력은 다듬어서 통과", () => {
  assert.deepEqual(readLinkFields(ok), { maker: "Anthropic", install_cmd: "/plugin install x@y", homepage_url: "https://github.com/a/b" });
  assert.equal(readLinkFields({ ...ok, homepage_url: "" }).homepage_url, "");
  assert.equal(readLinkFields({ ...ok, install_cmd: "" }).install_cmd, "");
});

test("링크형 글: 제작자 필수, 설치 명령·공식 페이지 중 하나 필수", () => {
  assert.throws(() => readLinkFields({ ...ok, maker: " " }), UploadError);
  assert.throws(() => readLinkFields({ ...ok, install_cmd: "", homepage_url: "" }), UploadError);
});

test("링크형 글: 공식 페이지는 http(s) 만", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "ftp://x.com", "not a url"]) {
    assert.throws(() => readLinkFields({ ...ok, homepage_url: bad }), UploadError, bad);
  }
});

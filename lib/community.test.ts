import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./test-db.ts";
import {
  addComment, listComments, deleteComment, countComments, toggleCommentReaction, togglePostReaction,
  createPost, updatePost, deletePost, getPost, listPosts, readPost, postNeighbors, CommunityError,
} from "./community.ts";
import { listNotices, unreadNotices } from "./queries.ts";

const SEED = `
  INSERT INTO app.users (id, email, name) OVERRIDING SYSTEM VALUE VALUES (1, 'owner@samsung.com', '주인'), (2, 'a@samsung.com', '에이'), (3, 'b@cheil.com', '');
  INSERT INTO app.skills (id, slug, name, author_name, author_email, owner_id) OVERRIDING SYSTEM VALUE VALUES
    (1, 'one', '스킬 하나', 'A', 'owner@samsung.com', 1), (2, 'two', '스킬 둘', 'A', 'owner@samsung.com', 1);
`;
const S1 = { skillId: 1 };

test("댓글: 대댓글은 한 단계로 접히고, 다른 글의 댓글엔 답글 불가, 빈 글·긴 글 거부", async () => {
  const db = await testDb(SEED);
  const top = await addComment(db, S1, 2, "  좋아요  ", null);
  const reply = await addComment(db, S1, 3, "답글", top);
  await addComment(db, S1, 1, "답글의 답글", reply); // → top 아래로
  const list = await listComments(db, S1, 1);
  assert.equal(list.length, 1);
  assert.equal(list[0].body, "좋아요");
  assert.deepEqual(list[0].replies.map((r) => [r.body, r.parent_id]), [["답글", top], ["답글의 답글", top]]);
  assert.equal(list[0].replies[0].author, "b@cheil.com"); // 이름이 없으면 이메일
  assert.equal(countComments(list), 3);
  await assert.rejects(addComment(db, { skillId: 2 }, 2, "x", top), CommunityError);
  await assert.rejects(addComment(db, S1, 2, "   ", null), /입력/);
  await assert.rejects(addComment(db, S1, 2, "가".repeat(2001), null), /2000/);
});

test("댓글 삭제: 글쓴이·에디터만, 답글이 있으면 자리만 남고 없으면 사라진다", async () => {
  const db = await testDb(SEED);
  const a = await addComment(db, S1, 2, "A", null);
  const b = await addComment(db, S1, 2, "B", null);
  const r = await addComment(db, S1, 3, "A에 답글", a);
  assert.equal(await deleteComment(db, a, { id: 3, editor: false }), false); // 남의 댓글
  assert.equal(await deleteComment(db, a, { id: 2, editor: false }), true);
  assert.equal(await deleteComment(db, b, { id: 3, editor: true }), true); // 에디터
  let list = await listComments(db, S1, 1);
  assert.deepEqual(list.map((c) => [c.id, c.deleted, c.body]), [[a, true, ""]]); // b 는 답글이 없어 사라짐
  assert.equal(countComments(list), 1);
  await deleteComment(db, r, { id: 3, editor: false });
  list = await listComments(db, S1, 1);
  assert.deepEqual(list, []); // 답글까지 지워지면 자리도 사라짐
});

test("공감: 사용자당 한 번 토글, 내 공감 표시", async () => {
  const db = await testDb(SEED);
  const c = await addComment(db, S1, 2, "A", null);
  await toggleCommentReaction(db, 1, c);
  await toggleCommentReaction(db, 3, c);
  await toggleCommentReaction(db, 3, c); // 취소
  const [row] = await listComments(db, S1, 1);
  assert.equal(row.reactions, 1);
  assert.equal(row.reacted, true);
  assert.equal((await listComments(db, S1, 3))[0].reacted, false);
});

test("게시판: 입력 검증, 글쓴이·에디터만 수정·삭제, 검색·댓글·공감 수", async () => {
  const db = await testDb(SEED);
  assert.throws(() => readPost({ title: "", body_md: "x", link_url: "" }), /제목/);
  assert.throws(() => readPost({ title: "t", body_md: "", link_url: "" }), /본문이나/);
  assert.throws(() => readPost({ title: "t", body_md: "x", link_url: "javascript:alert(1)" }), /http/);
  const id = await createPost(db, 2, { title: " GPT-6 발표 ", body_md: "요약", link_url: "https://example.com/a" });
  await createPost(db, 3, { title: "다른 소식", body_md: "본문", link_url: "" });
  assert.equal(await updatePost(db, id, { id: 3, editor: false }, { title: "x", body_md: "y", link_url: "" }), false);
  assert.equal(await updatePost(db, id, { id: 2, editor: false }, { title: "GPT-6 정리", body_md: "요약", link_url: "" }), true);
  const pc = { postId: id };
  await addComment(db, pc, 3, "와", null);
  await togglePostReaction(db, 3, id);
  const p = (await getPost(db, id, 3))!;
  assert.deepEqual([p.title, p.reactions, p.reacted, p.author], ["GPT-6 정리", 1, true, "에이"]);
  const found = await listPosts(db, { q: "gpt" });
  assert.deepEqual(found.rows.map((r) => [r.title, r.comments, r.reactions]), [["GPT-6 정리", 1, 1]]);
  assert.equal(found.total, 1);
  assert.equal((await listPosts(db, { page: Number("abc") })).rows.length, 2); // 잘못된 page 도 1쪽
  assert.equal(await deletePost(db, id, { id: 3, editor: false }), false);
  assert.equal(await deletePost(db, id, { id: 1, editor: true }), true);
  assert.equal(await getPost(db, id, 1), undefined);
});

test("알림: 내 글의 남의 댓글, 내 댓글의 남의 답글(중복 없이), 내 것은 알림 아님", async () => {
  const db = await testDb(SEED);
  await db.query("UPDATE app.users SET inbox_seen_at = now() - interval '1 day'");
  const mine = await addComment(db, S1, 1, "주인 댓글", null); // 내 글에 내 댓글 → 알림 없음
  await addComment(db, S1, 2, "에이 답글", mine); // 내 댓글에 답글 → reply 하나
  const other = await addComment(db, S1, 2, "에이 댓글", null); // 내 글에 남의 댓글 → comment
  await addComment(db, S1, 3, "비 답글", other); // 내 글 + 남의 댓글에 답글 → 주인에겐 comment, 에이에겐 reply
  const owner = await listNotices(db, 1);
  assert.deepEqual(owner.map((n) => n.kind).sort(), ["comment", "comment", "reply"]);
  assert.ok(owner.every((n) => n.href.startsWith("/skills/one#c") && n.name === "스킬 하나"));
  assert.equal(await unreadNotices(db, 1), 3);
  assert.deepEqual((await listNotices(db, 2)).map((n) => n.kind), ["reply"]);
  const post = await createPost(db, 3, { title: "소식", body_md: "x", link_url: "" });
  await addComment(db, { postId: post }, 2, "게시판 댓글", null);
  const b = await listNotices(db, 3);
  assert.equal(b[0].href.replace(/#c\d+$/, ""), `/board/${post}`);
  assert.equal(b[0].name, "소식");
});

test("글 이동: 이전(오래된)·다음(새) 글과 이 글이 들어 있는 목록 쪽", async () => {
  const db = await testDb(SEED);
  const ids: number[] = [];
  for (let i = 1; i <= 22; i++) ids.push(await createPost(db, 2, { title: `글 ${i}`, body_md: "x", link_url: "" }));
  const first = await postNeighbors(db, ids[0]); // 가장 오래된 글 → 최신순 목록의 2쪽
  assert.deepEqual([first.prev, first.next?.title, first.page], [null, "글 2", 2]);
  const last = await postNeighbors(db, ids[21]);
  assert.deepEqual([last.prev?.title, last.next, last.page], ["글 21", null, 1]);
  assert.equal((await postNeighbors(db, ids[2])).page, 1); // 글 3 은 최신 20개 안
  await deletePost(db, ids[1], { id: 2, editor: false });
  assert.equal((await postNeighbors(db, ids[0])).next?.title, "글 3"); // 지운 글은 건너뜀
});

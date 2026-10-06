import { ImapFlow, type MessageStructureObject } from "imapflow";
import { BRIEFING_SUBJECT, htmlText } from "./briefing";

// 로그인 메일 발송용 Gmail 계정(SMTP_USER + 앱 비밀번호)을 IMAP 으로 읽는다.
// '보낸편지함'에서만 찾는다 → 내 계정이 직접 보낸 메일만. 남이 From 을 위조해 보낸 메일은 여기에 없다.
export async function fetchBriefings(days = 3): Promise<{ subject: string; text: string }[]> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error("SMTP_USER / SMTP_PASS 환경변수가 필요합니다");
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    logger: false,
  });
  await client.connect();
  try {
    const sent = (await client.list()).find((b) => b.specialUse === "\\Sent");
    if (!sent) throw new Error("Gmail 보낸편지함을 찾지 못했습니다");
    const lock = await client.getMailboxLock(sent.path);
    try {
      const uids = (await client.search({ gmraw: `subject:"${BRIEFING_SUBJECT}" newer_than:${days}d` }, { uid: true })) || [];
      const out: { subject: string; text: string }[] = [];
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { envelope: true, bodyStructure: true }, { uid: true });
        if (!msg || !msg.bodyStructure) continue;
        const part = findPart(msg.bodyStructure, "text/plain") ?? findPart(msg.bodyStructure, "text/html");
        if (!part) continue;
        const dl = await client.download(String(uid), part.part ?? "1", { uid: true });
        if (!("content" in dl) || !dl.content) continue;
        const chunks: Buffer[] = [];
        for await (const c of dl.content) chunks.push(c as Buffer);
        const body = Buffer.concat(chunks).toString("utf8");
        out.push({ subject: msg.envelope?.subject ?? "", text: part.type === "text/html" ? htmlText(body) : body });
      }
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

function findPart(node: MessageStructureObject, type: string): MessageStructureObject | undefined {
  if (node.type === type && node.disposition !== "attachment") return node;
  for (const child of node.childNodes ?? []) {
    const hit = findPart(child, type);
    if (hit) return hit;
  }
}

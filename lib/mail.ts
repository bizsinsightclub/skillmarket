import nodemailer from "nodemailer";

// 메일 속 링크의 사이트 주소. Vercel 이 넣어 주는 운영 도메인, 없으면 로컬.
export function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// 메일마다 연결을 새로 맺는다(서버리스 함수가 멈췄다 깨면 열어 둔 연결이 끊겨 로그인 메일이 실패할 수 있어서).
// 월간 메일은 한 번에 60통이라 maxDuration(300초) 안에 끝난다.
export async function sendMail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST) {
    if (process.env.VERCEL) throw new Error("SMTP_HOST 가 설정되지 않았습니다"); // 배포 환경에서는 콘솔 출력 금지
    console.log(`[mail:dev] ${to} · ${subject}\n${text}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  // Gmail: smtp.gmail.com:465 + 앱 비밀번호. 보내는 주소(MAIL_FROM)는 SMTP_USER 와 같아야 한다.
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || `스킬마켓 <${process.env.SMTP_USER}>`, to, subject, text });
}

export function sendLoginCode(to: string, code: string) {
  return sendMail(
    to,
    `[스킬마켓] 로그인 코드 ${code}`,
    `로그인 코드: ${code}\n\n10분 안에 입력하세요. 요청한 적이 없다면 이 메일을 무시하세요.\n\n` +
      `※ 이 코드는 스킬마켓 로그인 화면에만 입력하세요. 올라온 글·데모·앱 화면이 코드를 물어보면 입력하지 마세요(계정 도용 시도).`,
  );
}

// 남이 나를 원작자로 적어 올렸을 때. 실패해도 업로드는 그대로(알림함에도 뜬다).
// ponytail: 로그인 메일의 하루 전체 한도(MAX_SENDS_GLOBAL_DAY)에 세지 않는다. Gmail 한도가 빠듯해지면 Resend 로.
export async function sendAuthorConfirm(to: string, p: { skillName: string; uploader: string; slug: string }) {
  try {
    await sendMail(
      to,
      `[스킬마켓] ${p.uploader} 님이 회원님을 '${p.skillName}' 의 원작자로 적었습니다`,
      `${p.uploader} 님이 스킬마켓에 '${p.skillName}' 글을 올리면서 원작자로 회원님을 적었습니다.\n\n` +
        `맞으면 '맞아요', 회원님이 만든 것이 아니면 '제가 아니에요'를 눌러 주세요. 아니라고 하시면 에디터가 확인합니다.\n\n` +
        `${siteUrl()}/skills/${encodeURIComponent(p.slug)}\n\n(사내 메일로 로그인하면 바로 답할 수 있습니다.)`,
    );
  } catch (e) {
    console.error("원작자 확인 메일 실패", e);
  }
}

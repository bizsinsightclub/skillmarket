import nodemailer from "nodemailer";

export async function sendLoginCode(to: string, code: string) {
  if (!process.env.SMTP_HOST) {
    if (process.env.VERCEL) throw new Error("SMTP_HOST 가 설정되지 않았습니다"); // 배포 환경에서는 콘솔 출력 금지
    console.log(`[mail:dev] ${to} 로그인 코드: ${code}`);
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
  await transport.sendMail({
    from: process.env.MAIL_FROM || `스킬마켓 <${process.env.SMTP_USER}>`,
    to,
    subject: `[스킬마켓] 로그인 코드 ${code}`,
    text: `로그인 코드: ${code}\n\n10분 안에 입력하세요. 요청한 적이 없다면 이 메일을 무시하세요.`,
  });
}

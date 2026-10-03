import { Resend } from 'resend';

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mail:dev] 비밀번호 재설정 링크 (${to}): ${resetUrl}`);
      return;
    }
    throw new Error('RESEND_API_KEY is not set');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !process.env.MAIL_FROM) {
    throw new Error('MAIL_FROM is not set');
  }
  if (isProduction && !resetUrl.startsWith('http')) {
    throw new Error(
      'Reset URL is not absolute; set NEXTAUTH_URL in production'
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
    to,
    subject: '[오쓰그라운드] 비밀번호 재설정 안내',
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p>비밀번호 재설정을 요청하셨습니다. 아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">
            비밀번호 재설정
          </a>
        </p>
        <p>이 링크는 1시간 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}

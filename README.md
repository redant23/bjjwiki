This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 환경 변수

`.env.local`에 아래 값을 설정합니다. (실제 값은 저장소에 커밋하지 않습니다.)

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: 구글 로그인용 OAuth 클라이언트. 구글 콘솔의 승인된 리디렉션 URI에 `{NEXTAUTH_URL}/api/auth/callback/google`을 등록해야 합니다.
- `RESEND_API_KEY`: 비밀번호 재설정 메일 발송용 Resend API 키. 개발 환경에서는 선택 사항이며, 없으면 재설정 링크가 서버 콘솔에 출력됩니다.
- `MAIL_FROM`: 발신 주소. Resend에서 인증된 발신 도메인의 주소여야 하며, 프로덕션에서는 필수입니다.
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`: 프로덕션에서는 반드시 설정해야 합니다. (`NEXTAUTH_URL`은 재설정 메일의 링크 주소에도 사용됩니다.)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

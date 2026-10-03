import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-6 border rounded-lg shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">새 비밀번호 설정</h1>
          <p className="text-gray-500 dark:text-gray-400">
            8자 이상의 새 비밀번호를 입력해 주세요
          </p>
        </div>
        <ResetPasswordForm token={token ?? ''} />
      </div>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '개인정보처리방침 | 오쓰그라운드' };

export default function PrivacyPage() {
  return (
    <article className="space-y-6 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold">개인정보처리방침</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. 수집하는 정보</h2>
        <p>
          회원가입 시 이메일, 닉네임, (이메일 가입의 경우) 암호화된 비밀번호를 수집하며, Google 로그인 시
          Google 계정의 이메일과 이름을 제공받습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. 방문 통계 (Google Analytics)</h2>
        <p>
          Google Analytics를 사용해 방문 통계(페이지 조회, 유입 경로, 기기 정보 등)를 수집합니다. 개인을
          식별하지 않는 통계 목적이며, 브라우저 설정으로 쿠키를 거부할 수 있습니다.
        </p>
        <p>
          또한 기술 상세 페이지의 조회수를 서비스 개선을 위해 자체 집계하며, 중복 집계를 막기 위해 30분간
          유지되는 쿠키를 사용합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. 이용 목적</h2>
        <p>회원 식별 및 로그인, 서비스 제공, 서비스 개선을 위한 통계 분석에 사용합니다.</p>
      </section>
    </article>
  );
}

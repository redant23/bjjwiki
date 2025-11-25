import Image from "next/image";

export default function Home() {
  return (
    <div className="container max-w-4xl mx-auto px-4">
      <div className="space-y-6">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          주짓수 기술 위키에 오신 것을 환영합니다
        </h1>
        <p className="leading-7 [&:not(:first-child)]:mt-6">
          커뮤니티가 함께 만들어가는 브라질리안 주짓수 기술 데이터베이스입니다.
          사이드바에서 카테고리를 선택하거나 검색하여 기술을 찾아보세요.
        </p>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight mb-4">
            최근 추가된 기술
          </h3>
          <p className="text-muted-foreground">
            아직 추가된 기술이 없습니다. 첫 번째 기여자가 되어보세요!
          </p>
        </div>
      </div>
    </div>
  );
}

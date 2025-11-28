import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative w-full py-12 md:py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero.png"
            alt="BJJ Training"
            fill
            className="object-cover opacity-20 dark:opacity-10"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/60 to-background" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                주짓수 위키
              </h1>
              <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl">
                커뮤니티 주도형 브라질리언 주짓수 기술 데이터베이스.
                <br className="hidden sm:inline" />
                함께 배우고, 기록하고, 성장하세요.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/technique/new"
                className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-8 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                기술 등록하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/technique/guard/open-guard"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-primary-foreground/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                기술 둘러보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full py-12 md:py-24 lg:py-32 border-t border-border">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-md transition-all hover:border-primary/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">체계적인 분류</h3>
            <p className="text-muted-foreground">
              가드, 패스, 서브미션 등 포지션과 상황별로 정리된 기술 트리를 탐색하세요.
            </p>
          </div>
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-md transition-all hover:border-primary/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">기술 연결</h3>
            <p className="text-muted-foreground">
              각 기술에서 파생되는 서브미션, 스윕, 카운터 기술들의 연결 고리를 확인하세요.
            </p>
          </div>
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:shadow-md transition-all hover:border-primary/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">커뮤니티 기여</h3>
            <p className="text-muted-foreground">
              자신만의 노하우나 새로운 디테일을 추가하여 위키를 함께 만들어가세요.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

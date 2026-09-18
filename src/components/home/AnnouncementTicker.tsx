'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface AnnouncementItem {
  _id: string;
  name: string;
  href: string;
}

interface AnnouncementTickerProps {
  items: AnnouncementItem[];
}

export function AnnouncementTicker({ items }: AnnouncementTickerProps) {
  const pathname = usePathname();

  // 홈페이지 전용 공지: 다른 페이지에서는 노출하지 않는다.
  if (pathname !== '/' || items.length === 0) {
    return null;
  }

  // 네비바(Navbar)와 형제 레벨(사이드바+메인 위)에 렌더링되므로, 사이드바를
  // 포함한 화면 전체 폭을 한 줄로 가로지른다. sticky top-14로 네비바
  // (h-14, 3.5rem) 바로 아래에 붙어 스크롤 중에도 고정되고, 고정 높이
  // h-10을 둬서 사이드바의 top 오프셋(top-24, layout.tsx 참고)과 어긋나지
  // 않게 유지한다.
  const stickyBarClasses = 'sticky top-14 z-40 h-10 w-full border-b border-border bg-accent/10';

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className={stickyBarClasses}>
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-2 px-4 text-sm sm:px-6 lg:px-8">
          <span className="shrink-0 font-semibold text-accent">공지</span>
          <Link href={item.href} className="truncate hover:underline">
            {item.name} 기술이 새로 업데이트되었습니다.
          </Link>
        </div>
      </div>
    );
  }

  // 항목 수에 비례해 한 바퀴 도는 시간을 늘려, 항목이 많아도 읽을 시간을 확보한다.
  const durationSeconds = Math.max(items.length * 4, 15);

  return (
    <div className={`${stickyBarClasses} overflow-hidden`}>
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span className="shrink-0 text-sm font-semibold text-accent">공지</span>
        <div className="relative flex-1 overflow-hidden">
          <div
            className="animate-marquee flex w-max whitespace-nowrap"
            style={{ animationDuration: `${durationSeconds}s` }}
          >
            {/* 두 벌을 감싸는 바깥 트랙에는 gap을 주지 않는다 — 두 벌의 폭이
                정확히 같아야 translateX(-50%)가 이음매 없이 딱 맞아떨어진다.
                항목 사이 간격(gap-8)과 이음매 간격(pr-8)은 각 벌 안에서
                동일하게 줘서 반복 지점에서 간격이 튀지 않게 한다. */}
            <div className="flex items-center gap-8 pr-8">
              {items.map((item) => (
                <Link key={item._id} href={item.href} className="text-sm hover:underline">
                  {item.name} 기술이 새로 업데이트되었습니다.
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-8 pr-8" aria-hidden="true">
              {items.map((item) => (
                <Link
                  key={`clone-${item._id}`}
                  href={item.href}
                  className="text-sm hover:underline"
                  tabIndex={-1}
                >
                  {item.name} 기술이 새로 업데이트되었습니다.
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

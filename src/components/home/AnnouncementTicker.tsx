'use client';

import Link from 'next/link';

export interface AnnouncementItem {
  _id: string;
  name: string;
  href: string;
}

interface AnnouncementTickerProps {
  items: AnnouncementItem[];
}

export function AnnouncementTicker({ items }: AnnouncementTickerProps) {
  if (items.length === 0) {
    return null;
  }

  // sticky top-14: 헤더(h-14, 3.5rem)에 딱 붙어 스크롤 시에도 그 아래 고정된다.
  // -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-10: 부모(main) 컨테이너의 좌우 padding과
  // 상단 padding을 상쇄해, 네비바 바로 밑에 여백 없이 붙고 모바일에서는
  // 컨텐츠 최상단에서 화면 폭 전체를 채운다.
  const stickyBleedClasses =
    'sticky top-14 z-40 -mx-4 -mt-6 sm:-mx-6 lg:-mx-8 lg:-mt-10';

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className={`${stickyBleedClasses} border-b border-border bg-accent/10 py-2`}>
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 text-sm sm:px-6 lg:px-8">
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
    <div className={`${stickyBleedClasses} overflow-hidden border-b border-border bg-accent/10 py-2`}>
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 sm:px-6 lg:px-8">
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

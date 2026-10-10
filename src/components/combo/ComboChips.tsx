'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// 칩 높이 28px(h-7) + 줄 간격 4px(gap-y-1). 3번째 줄은 top이 64px부터 시작한다.
const THIRD_ROW_TOP = 48;

/** 기술 순서 칩. 최대 2줄까지만 보이고 넘치면 마지막에 "+N" 칩을 둔다. 칩은 클릭 대상이 아니다. */
export function ComboChips({ names }: { names: string[] }) {
  const total = names.length;
  const ref = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(total);
  const [tick, setTick] = useState(0);
  const widthRef = useRef(0);
  const shown = Math.min(limit, total);
  const hidden = total - shown;

  // 폭이 바뀌면 다시 전부 펼친 뒤 측정한다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width === widthRef.current) return;
      widthRef.current = width;
      setLimit(total);
      setTick((t) => t + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [total]);

  // 3번째 줄로 밀린 요소가 있으면 하나씩 줄여 +N 칩까지 2줄에 들어오게 한다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const overflowIndex = Array.from(el.children).findIndex(
      (child) => (child as HTMLElement).offsetTop >= THIRD_ROW_TOP
    );
    if (overflowIndex === -1) return;
    setLimit(Math.max(1, Math.min(overflowIndex, shown - 1)));
  }, [shown, total, tick]);

  const chipClass =
    'inline-flex h-7 max-w-full items-center rounded-full bg-muted px-2.5 text-[13px] md:text-sm font-medium text-foreground';

  return (
    <div
      ref={ref}
      className="relative flex max-h-[60px] flex-wrap items-center gap-x-1 gap-y-1 overflow-hidden"
      aria-label={`기술 순서: ${names.join(' → ')}`}
    >
      {names.slice(0, shown).map((name, index) => (
        <span key={index} className="inline-flex max-w-full items-center gap-1">
          <span className={`${chipClass} truncate`}>{name}</span>
          {(index < total - 1) && (
            <span className="text-muted-foreground" aria-hidden="true">→</span>
          )}
        </span>
      ))}
      {hidden > 0 && (
        <span className={chipClass} title={names.slice(shown).join(', ')}>
          +{hidden}
        </span>
      )}
    </div>
  );
}

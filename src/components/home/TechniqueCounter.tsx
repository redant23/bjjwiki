'use client';

import { useEffect, useState } from 'react';

const DURATION_MS = 2200;

// easeOutExpo: 처음엔 빠르게 치고 올라가다 목표값 근처에서 감속 — 시선이 끝까지 머문다.
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function TechniqueCounter({ count }: { count: number }) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(count);
      setDone(true);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setValue(Math.round(easeOutExpo(progress) * count));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  return (
    <div className="relative flex flex-col items-center">
      {/* 스크린리더/검색엔진에는 최종 문장을 그대로 전달 */}
      <p className="sr-only">{count.toLocaleString('ko-KR')}개의 주짓수 기술이 있습니다.</p>

      <div aria-hidden className="relative flex flex-col items-center">
        {/* 숫자 뒤에서 숨쉬듯 퍼지는 글로우 */}
        <span className="counter-glow pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 sm:h-56 sm:w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-3xl" />

        <p className="relative mb-2 text-sm sm:text-base font-medium tracking-wide text-muted-foreground">
          지금 오쓰그라운드에는
        </p>

        <div className="relative flex items-baseline justify-center gap-1 sm:gap-2">
          <span
            className={`counter-number text-7xl sm:text-8xl md:text-9xl font-black tabular-nums leading-none tracking-tight ${
              done ? 'counter-done' : ''
            }`}
          >
            {value.toLocaleString('ko-KR')}
          </span>
          <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">개의</span>
        </div>

        <p className="relative mt-3 text-xl sm:text-2xl md:text-3xl font-semibold text-foreground">
          주짓수 기술이 있습니다.
        </p>
      </div>
    </div>
  );
}

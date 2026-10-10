import Link from 'next/link';

export interface ChipItem {
  name: string;
  /** 있으면 칩이 링크가 된다 (상세 페이지). 카드에서는 비워 클릭 불가로 둔다 */
  href?: string;
}

const CHIP_CLASS =
  'inline-flex h-[30px] max-w-full items-center gap-1.5 rounded-full bg-muted pl-1.5 pr-3 text-sm font-medium text-foreground md:text-[15px]';

/**
 * 기술 순서 칩. 접지 않고 전부 보여 주며 줄바꿈을 허용한다.
 * 화살표는 뒤따르는 칩과 한 덩어리(nowrap)로 묶어, 줄 끝/줄 시작에 홀로 남지 않는다.
 */
export function ComboChips({ items, className = '' }: { items: ChipItem[]; className?: string }) {
  return (
    <ol
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1.5 ${className}`}
      aria-label={`기술 순서: ${items.map((i) => i.name).join(' → ')}`}
    >
      {items.map((item, index) => {
        const body = (
          <>
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold tabular-nums text-muted-foreground"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="truncate">{item.name}</span>
          </>
        );
        return (
          <li key={index} className="inline-flex max-w-full items-center gap-1.5">
            {index > 0 && (
              <span className="text-muted-foreground" aria-hidden="true">
                →
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className={`${CHIP_CLASS} transition-colors hover:bg-muted/60`}>
                {body}
              </Link>
            ) : (
              <span className={CHIP_CLASS}>{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

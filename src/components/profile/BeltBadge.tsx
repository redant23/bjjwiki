import { cn } from '@/lib/utils';

export type BeltLevel = 'white' | 'blue' | 'purple' | 'brown' | 'black';

const BODY_COLOR: Record<BeltLevel, string> = {
  white: '#ebebeb',
  blue: '#1879fe',
  purple: '#ae00b9',
  brown: '#965501',
  black: '#2a2a2a',
};

const BODY_WIDTH = 358;
const BAR_WIDTH = 190;
const HEIGHT = 81;

export function BeltBadge({ level, stripe, className }: { level: BeltLevel; stripe: number; className?: string }) {
  const barColor = level === 'black' ? '#e00c00' : '#2a2a2a';
  const dense = stripe > 4;
  const stripeWidth = dense ? 16 : 21;
  const pitch = dense ? 30 : 44;
  const offset = dense ? 8 : 18;

  return (
    <svg
      viewBox={`0 0 ${BODY_WIDTH + BAR_WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${level} belt, ${stripe} stripes`}
      className={cn('h-6 w-auto', className)}
    >
      <rect x="0" y="0" width={BODY_WIDTH} height={HEIGHT} fill={BODY_COLOR[level]} />
      <rect x={BODY_WIDTH} y="0" width={BAR_WIDTH} height={HEIGHT} fill={barColor} />
      {Array.from({ length: stripe }, (_, i) => (
        <rect key={i} x={BODY_WIDTH + offset + i * pitch} y="0" width={stripeWidth} height={HEIGHT} fill="#ffffff" />
      ))}
      <rect
        x="0.5"
        y="0.5"
        width={BODY_WIDTH + BAR_WIDTH - 1}
        height={HEIGHT - 1}
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
      />
    </svg>
  );
}

import { cn } from '@/lib/utils';

function MaskedSvg({ src, label, aspect, className }: { src: string; label?: string; aspect: number; className?: string }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block bg-current', className)}
      style={{
        aspectRatio: aspect,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}

export function LogoMark({ className }: { className?: string }) {
  return <MaskedSvg src="/brand/ossrec.svg" aspect={1591.21 / 1537} className={className} />;
}

export function LogoWordmark({ className }: { className?: string }) {
  return <MaskedSvg src="/brand/ossground.svg" label="ossground" aspect={1704.2 / 348.1} className={className} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-foreground', className)}>
      <LogoMark className="h-8" />
      <LogoWordmark className="h-4" />
    </span>
  );
}

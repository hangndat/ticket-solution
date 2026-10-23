import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn.js';

export type CatalogHeroBandProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId?: string;
  intro?: ReactNode;
};

export function CatalogHeroBand({
  className,
  eyebrow,
  title,
  titleId,
  intro,
  children,
  ...props
}: CatalogHeroBandProps) {
  return (
    <section
      className={cn(
        'relative -mx-[var(--spacing-2xl)] mb-[var(--spacing-2xl)] overflow-hidden px-[var(--spacing-2xl)] py-9 text-paper',
        'bg-[linear-gradient(145deg,var(--color-ink)_0%,color-mix(in_srgb,var(--color-ink)_88%,var(--color-focus))_55%,color-mix(in_srgb,var(--color-ink)_82%,var(--color-signal))_100%)]',
        'before:pointer-events-none before:absolute before:-right-[120px] before:-top-[180px] before:size-[420px] before:rounded-full before:bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-signal)_35%,transparent),transparent_65%)]',
        'after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(ellipse_80%_50%_at_20%_100%,color-mix(in_srgb,var(--color-focus)_12%,transparent),transparent)]',
        'max-sm:-mx-[var(--spacing-2xl)] max-sm:px-[var(--spacing-2xl)]',
        className,
      )}
      {...props}
    >
      <div className="relative z-[1] max-w-[40rem]">
        {eyebrow ? (
          <p className="m-0 mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-paper/60">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="m-0 mb-2.5 font-display text-[clamp(1.75rem,4vw,2.35rem)] leading-[1.15] tracking-[-0.03em] text-paper"
          id={titleId}
        >
          {title}
        </h1>
        {intro ? (
          <p className="m-0 max-w-[36rem] text-[0.95rem] text-paper/75">{intro}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

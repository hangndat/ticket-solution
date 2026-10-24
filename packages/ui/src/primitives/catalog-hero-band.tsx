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
        'mb-[var(--spacing-2xl)] flex flex-col gap-5 border-b border-line bg-paper pb-8 pt-9 text-ink sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 max-w-[40rem]">
        {eyebrow ? (
          <p className="m-0 mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="m-0 font-display text-[clamp(1.9rem,4vw,2.65rem)] leading-[1.15] tracking-[-0.03em] text-ink"
          id={titleId}
        >
          {title}
        </h1>
        {intro ? (
          <p className="mb-0 mt-3 max-w-[36rem] text-[0.95rem] text-muted">{intro}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </section>
  );
}

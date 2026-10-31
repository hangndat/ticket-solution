'use client';

import type { CSSProperties, FocusEvent, MouseEvent, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { cn } from '../cn.js';
import { DemoBadge } from './demo-badge.js';

export type CatalogEventCardArtTone = 'default' | 'green' | 'gold';

export type CatalogEventCardProps = {
  href: string;
  title: string;
  organization: string;
  meta: string;
  actionLabel: string;
  artLabel: string;
  artTone?: CatalogEventCardArtTone;
  showDemoBadge?: boolean;
  ownedStrip?: ReactNode;
  testId?: string;
  artTestId?: string;
};

const artToneClass: Record<CatalogEventCardArtTone, string> = {
  default:
    'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-focus)_55%,var(--color-ink)),var(--color-ink))] after:border-[color-mix(in_srgb,var(--color-primary)_50%,transparent)]',
  green:
    'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-admit)_65%,var(--color-ink)),var(--color-ink))] after:border-[color-mix(in_srgb,var(--color-admit)_55%,transparent)]',
  gold:
    'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-unknown)_55%,var(--color-ink)),var(--color-ink))] after:border-[color-mix(in_srgb,var(--color-unknown)_55%,transparent)]',
};

export function CatalogEventCard({
  href,
  title,
  organization,
  meta,
  actionLabel,
  artLabel,
  artTone = 'default',
  showDemoBadge = false,
  ownedStrip,
  testId,
  artTestId,
}: CatalogEventCardProps) {
  const [spotStyle, setSpotStyle] = useState<CSSProperties | undefined>();

  const onMove = useCallback(
    (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const x =
        'clientX' in event ? event.clientX - rect.left : rect.width / 2;
      const y =
        'clientY' in event ? event.clientY - rect.top : rect.height / 3;
      setSpotStyle({
        '--catalog-mx': `${x}px`,
        '--catalog-my': `${y}px`,
      } as CSSProperties);
    },
    [],
  );

  const onLeave = useCallback(() => {
    setSpotStyle(undefined);
  }, []);

  return (
    <article className="relative flex h-full min-w-0 list-none flex-col" data-testid={testId}>
      <a
        className={cn(
          'relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-paper text-inherit no-underline',
          'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          'hover:-translate-y-[3px] hover:border-line hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--color-ink)_8%,transparent)] motion-reduce:hover:translate-none',
          'before:pointer-events-none before:absolute before:inset-0 before:z-[2] before:opacity-0 before:transition-opacity before:duration-200 motion-reduce:before:transition-none',
          'before:bg-[radial-gradient(600px_circle_at_var(--catalog-mx,50%)_var(--catalog-my,0%),color-mix(in_srgb,var(--color-focus)_8%,transparent),transparent_40%)]',
          'hover:before:opacity-100 focus-within:before:opacity-100',
        )}
        href={href}
        style={spotStyle}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onFocus={onMove}
        onBlur={onLeave}
      >
        <div
          className={cn(
            'relative flex h-[168px] shrink-0 items-end overflow-hidden p-[22px] text-paper',
            'after:pointer-events-none after:absolute after:-right-[50px] after:-top-[30px] after:size-[160px] after:rounded-full after:border-[28px] after:opacity-70',
            artToneClass[artTone],
          )}
          data-testid={artTestId}
          aria-hidden="true"
        >
          {showDemoBadge ? <DemoBadge className="absolute left-3 top-3 z-[2]" /> : null}
          <span className="z-[1] font-display text-[2rem] font-extrabold tracking-[-0.04em]">
            {artLabel}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 break-words px-5 pb-5 pt-[18px]">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
            {organization}
          </span>
          <h2 className="m-0 font-display text-[1.1rem] tracking-[-0.02em]">{title}</h2>
          <p className="m-0 text-[0.85rem] text-muted">{meta}</p>
          <span className="mt-auto pt-1 text-[0.88rem] font-bold text-primary">
            {actionLabel} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </a>
      {ownedStrip}
    </article>
  );
}

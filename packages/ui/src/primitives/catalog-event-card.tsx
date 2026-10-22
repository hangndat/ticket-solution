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
    <article className="catalog-event-card" data-testid={testId}>
      <a
        className="catalog-event-card__link"
        href={href}
        style={spotStyle}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onFocus={onMove}
        onBlur={onLeave}
      >
        <div
          className={cn(
            'catalog-event-card__art',
            artTone !== 'default' && `catalog-event-card__art--${artTone}`,
          )}
          data-testid={artTestId}
          aria-hidden="true"
        >
          {showDemoBadge ? (
            <DemoBadge className="catalog-event-card__demo-badge" />
          ) : null}
          <span className="catalog-event-card__art-fallback">{artLabel}</span>
        </div>
        <div className="catalog-event-card__body">
          <span className="catalog-event-card__eyebrow">{organization}</span>
          <h2 className="catalog-event-card__title">{title}</h2>
          <p className="catalog-event-card__meta">{meta}</p>
          <span className="catalog-event-card__action">
            {actionLabel} <span aria-hidden="true">↗</span>
          </span>
        </div>
      </a>
      {ownedStrip}
    </article>
  );
}

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
    <section className={cn('catalog-hero-band', className)} {...props}>
      <div className="catalog-hero-band__inner">
        {eyebrow ? <p className="catalog-hero-band__eyebrow">{eyebrow}</p> : null}
        <h1 className="catalog-hero-band__title" id={titleId}>{title}</h1>
        {intro ? <p className="catalog-hero-band__intro">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}

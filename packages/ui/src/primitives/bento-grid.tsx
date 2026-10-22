import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type BentoGridProps = HTMLAttributes<HTMLDivElement>;

/**
 * Flat asymmetric marketing bento layout (Aceternity bento-grid pattern, vendored).
 * No 3D tilt — hover border handled by consumer CSS.
 */
export function BentoGrid({ className, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[minmax(11rem,auto)]',
        className,
      )}
      {...props}
    />
  );
}

export type BentoGridItemProps = HTMLAttributes<HTMLDivElement> & {
  /** Desktop column span (1–4). */
  colSpan?: 1 | 2 | 3 | 4;
  /** Desktop row span. */
  rowSpan?: 1 | 2;
  /** Featured tile on mobile (taller min-height). */
  featured?: boolean;
};

const colSpanClass: Record<1 | 2 | 3 | 4, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
};

const rowSpanClass: Record<1 | 2, string> = {
  1: 'md:row-span-1',
  2: 'md:row-span-2',
};

export function BentoGridItem({
  className,
  colSpan = 1,
  rowSpan = 1,
  featured = false,
  ...props
}: BentoGridItemProps) {
  return (
    <div
      className={cn(
        colSpanClass[colSpan],
        rowSpanClass[rowSpan],
        featured && 'min-h-[14rem] md:min-h-0',
        className,
      )}
      {...props}
    />
  );
}

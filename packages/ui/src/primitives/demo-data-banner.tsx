import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type DemoDataBannerProps = HTMLAttributes<HTMLElement>;

/** Honest demo-data strip (MKT spec) — mount only when env enables it. */
export function DemoDataBanner({ className, children, ...props }: DemoDataBannerProps) {
  return (
    <aside
      className={cn(
        'border-b border-paper/10 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-ink)_92%,var(--color-focus)),var(--color-ink))] px-5 py-2 text-center text-[0.7rem] text-paper/80',
        '[&_strong]:font-semibold [&_strong]:text-[color-mix(in_srgb,var(--color-primary)_55%,var(--color-paper))]',
        className,
      )}
      role="status"
      data-testid="demo-data-strip"
      {...props}
    >
      {children ?? (
        <>
          <strong>Dữ liệu mô phỏng</strong>
          <span aria-hidden="true"> · </span>
          <span>Dữ liệu minh họa — không phải khách hàng thật</span>
        </>
      )}
    </aside>
  );
}

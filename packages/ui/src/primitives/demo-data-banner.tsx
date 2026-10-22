import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type DemoDataBannerProps = HTMLAttributes<HTMLElement>;

/** Honest demo-data strip (MKT spec) — mount only when env enables it. */
export function DemoDataBanner({ className, children, ...props }: DemoDataBannerProps) {
  return (
    <aside
      className={cn('demo-data-strip', className)}
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

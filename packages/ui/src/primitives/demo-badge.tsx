import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type DemoBadgeProps = HTMLAttributes<HTMLSpanElement>;

/** Warn-variant label for demo / seed tenants — never implies real customers. */
export function DemoBadge({ className, ...props }: DemoBadgeProps) {
  return (
    <span
      className={cn('demo-badge', className)}
      data-testid="demo-badge"
      {...props}
    >
      Demo
    </span>
  );
}

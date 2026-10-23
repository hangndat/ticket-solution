import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type DemoBadgeProps = HTMLAttributes<HTMLSpanElement>;

/** Warn-variant label for demo / seed tenants — never implies real customers. */
export function DemoBadge({ className, ...props }: DemoBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-full border border-[color-mix(in_srgb,var(--color-unknown)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-unknown)_12%,var(--color-paper))] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-unknown',
        className,
      )}
      data-testid="demo-badge"
      {...props}
    >
      Demo
    </span>
  );
}

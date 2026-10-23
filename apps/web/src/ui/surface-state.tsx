import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type SurfaceStateKind = 'empty' | 'loading' | 'error' | 'unknown';

export type SurfaceStateProps = {
  kind: SurfaceStateKind;
  title: string;
  detail?: string;
  action?: ReactNode;
  testId?: string;
};

const surfaceBase = cn(
  'my-4 grid max-w-[42rem] gap-2 border-2 p-[var(--spacing-2xl)]',
  'border-[color-mix(in_srgb,var(--color-ink)_12%,var(--color-paper))] bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-ink)_8%)]',
);

function surfaceKindClass(kind: SurfaceStateKind): string {
  switch (kind) {
    case 'loading':
      return cn(
        surfaceBase,
        'border-[color-mix(in_srgb,var(--color-focus)_40%,var(--color-ink)_12%)] bg-[color-mix(in_srgb,var(--color-paper)_90%,var(--color-focus)_10%)]',
        'motion-safe:animate-pulse motion-reduce:animate-none',
      );
    case 'error':
      return cn(surfaceBase, 'border-destructive/55 bg-destructive/10 text-destructive');
    case 'unknown':
      return cn(
        surfaceBase,
        'border-ink/40 bg-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))] text-ink',
      );
    case 'empty':
      return surfaceBase;
  }
}

/**
 * Consistent VI empty / error / loading / unknown chrome for demo surfaces.
 * No stack traces, no đợt jargon (F-WEB, W0, Identity POC).
 */
export function SurfaceState({
  kind,
  title,
  detail,
  action,
  testId,
}: SurfaceStateProps) {
  const role = kind === 'error' || kind === 'unknown' ? 'alert' : 'status';
  const ariaLive =
    kind === 'loading'
      ? 'polite'
      : kind === 'error' || kind === 'unknown'
        ? 'assertive'
        : undefined;
  return (
    <aside
      className={surfaceKindClass(kind)}
      role={role}
      aria-busy={kind === 'loading' ? true : undefined}
      aria-live={ariaLive}
      aria-atomic={ariaLive ? true : undefined}
      data-testid={testId}
      data-surface-state={kind}
    >
      <strong className="font-display text-[1.05rem] font-bold tracking-[-0.02em]">
        {title}
      </strong>
      {detail ? (
        <p className="m-0 text-[0.95rem] opacity-90">{detail}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </aside>
  );
}

/** @deprecated Use SurfaceState — kept for tests importing surfaceStateClass. */
export function surfaceStateClass(kind: SurfaceStateKind): string {
  return surfaceKindClass(kind);
}

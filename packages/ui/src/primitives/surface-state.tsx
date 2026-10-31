import type { ReactNode } from 'react';

export type SurfaceStateKind = 'empty' | 'loading' | 'error' | 'unknown';

export type SurfaceStateProps = {
  kind: SurfaceStateKind;
  title: string;
  detail?: string;
  action?: ReactNode;
  testId?: string;
};

const surfaceBase =
  'my-4 grid max-w-[42rem] gap-2 rounded-2xl border border-line p-[var(--spacing-2xl)] bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-ink)_8%)]';

/** Tailwind surface chrome — aligned with `apps/web/src/ui/surface-state`. */
export function surfaceStateClass(kind: SurfaceStateKind): string {
  switch (kind) {
    case 'loading':
      return [
        surfaceBase,
        'border-[color-mix(in_srgb,var(--color-focus)_40%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-paper)_90%,var(--color-focus)_10%)]',
        'motion-safe:animate-pulse motion-reduce:animate-none',
      ].join(' ');
    case 'error':
      return `${surfaceBase} border-destructive/55 bg-destructive/10 text-destructive`;
    case 'unknown':
      return `${surfaceBase} border-ink/40 bg-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))] text-ink`;
    case 'empty':
      return surfaceBase;
  }
}

/**
 * Empty / loading / error / unknown surfaces (VI product copy).
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
      className={surfaceStateClass(kind)}
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

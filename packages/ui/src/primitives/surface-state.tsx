import type { ReactNode } from 'react';

export type SurfaceStateKind = 'empty' | 'loading' | 'error' | 'unknown';

export type SurfaceStateProps = {
  kind: SurfaceStateKind;
  title: string;
  detail?: string;
  action?: ReactNode;
  testId?: string;
};

/** Class names aligned with `apps/web` Live Pulse legacy — swap import without visual change. */
export function surfaceStateClass(kind: SurfaceStateKind): string {
  switch (kind) {
    case 'empty':
      return 'surface-state state-empty';
    case 'loading':
      return 'surface-state state-loading';
    case 'error':
      return 'surface-state state-error';
    case 'unknown':
      return 'surface-state state-unknown';
  }
}

/**
 * Empty / loading / error / unknown surfaces (VI product copy).
 * Uses legacy `.surface-state` rules from `live-pulse-legacy.css` when consumed in apps/web.
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
      <strong className="surface-state__title">{title}</strong>
      {detail ? <p className="surface-state__detail">{detail}</p> : null}
      {action ? <div className="surface-state__action">{action}</div> : null}
    </aside>
  );
}

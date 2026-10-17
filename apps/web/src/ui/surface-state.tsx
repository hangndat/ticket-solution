import type { ReactNode } from 'react';

export type SurfaceStateKind = 'empty' | 'loading' | 'error' | 'unknown';

export type SurfaceStateProps = {
  kind: SurfaceStateKind;
  title: string;
  detail?: string;
  action?: ReactNode;
  testId?: string;
};

/** Shared class names for empty / loading / error / unknown demo surfaces. */
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
  return (
    <aside
      className={surfaceStateClass(kind)}
      role={role}
      aria-busy={kind === 'loading' ? true : undefined}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      data-testid={testId}
      data-surface-state={kind}
    >
      <strong className="surface-state__title">{title}</strong>
      {detail ? <p className="surface-state__detail">{detail}</p> : null}
      {action ? <div className="surface-state__action">{action}</div> : null}
    </aside>
  );
}

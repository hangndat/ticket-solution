/**
 * Live-region contract for redeem/admin status chrome (UX-10 A5).
 * unknown / queued → assertive alert; other status → polite status.
 * Does not claim WCAG AA for the whole app.
 */

export type LiveRegionKind =
  | 'unknown'
  | 'queued'
  | 'pending'
  | 'loading'
  | 'error'
  | 'success'
  | 'idle'
  | string;

export type LiveRegionAttrs = {
  role: 'alert' | 'status';
  ariaLive: 'assertive' | 'polite';
  ariaAtomic: true;
};

/** Map UX status kind → role + aria-live for screen readers. */
export function liveRegionForStatus(kind: LiveRegionKind): LiveRegionAttrs {
  if (
    kind === 'unknown' ||
    kind === 'queued' ||
    kind === 'error' ||
    kind === 'denied' ||
    kind === 'expired' ||
    kind === 'auth'
  ) {
    return { role: 'alert', ariaLive: 'assertive', ariaAtomic: true };
  }
  return { role: 'status', ariaLive: 'polite', ariaAtomic: true };
}

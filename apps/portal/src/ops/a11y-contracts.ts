/**
 * A11y sample contracts for portal harden (keyboard / axe prep).
 * Full headless axe UAT is T-UAT-PORTAL — this module is the P0.4 sample only.
 */

export const PORTAL_A11Y_SAMPLE = {
  skipLinkHref: '#portal-main',
  skipLinkClass: 'portal-skip-link',
  filterSearchRole: 'search',
  minHitTargetPx: 44,
  /** unknown / rejected must never map to success tone. */
  forbiddenSuccessKinds: ['unknown', 'rejected'] as const,
} as const;

/** Keyboard focus target: primary action after filter fields. */
export function filterToolbarTabOrder(): readonly string[] {
  return [
    'filter-field-1',
    'filter-field-2',
    'filter-apply',
    'filter-refresh',
  ] as const;
}

export function alertToneForKind(
  kind: 'list' | 'created' | 'status' | 'download' | 'rejected' | 'unknown',
): 'success' | 'warning' | 'error' {
  if (kind === 'rejected') return 'error';
  if (kind === 'unknown') return 'warning';
  return 'success';
}

export function assertUnknownNotSuccess(kind: string): boolean {
  return !(
    PORTAL_A11Y_SAMPLE.forbiddenSuccessKinds as readonly string[]
  ).includes(kind);
}

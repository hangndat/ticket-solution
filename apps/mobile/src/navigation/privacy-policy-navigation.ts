import { GUEST_HOME_HREF } from './attendee-account-route.ts';
import { STAFF_ACCOUNT_HREF } from './staff-account-route.ts';

export const PRIVACY_POLICY_HREF = '/privacy-policy' as const;

/** Who opened the policy — decides the no-history fallback home. */
export type PrivacyPolicyOrigin = 'attendee' | 'staff';

export function privacyPolicyHref(origin: PrivacyPolicyOrigin) {
  return { pathname: PRIVACY_POLICY_HREF, params: { from: origin } } as const;
}

export function parsePrivacyOrigin(
  raw: string | string[] | undefined,
): PrivacyPolicyOrigin {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'staff' ? 'staff' : 'attendee';
}

/** Fallback when a deep link lands here with no history. */
export function privacyDismissFallbackPath(origin: PrivacyPolicyOrigin) {
  return origin === 'staff' ? STAFF_ACCOUNT_HREF : GUEST_HOME_HREF;
}

export type PrivacyDismissAction =
  | { kind: 'back' }
  | { kind: 'replace'; pathname: string };

export function resolvePrivacyDismissAction(
  canGoBack: boolean,
  origin: PrivacyPolicyOrigin = 'attendee',
): PrivacyDismissAction {
  return canGoBack
    ? { kind: 'back' }
    : { kind: 'replace', pathname: privacyDismissFallbackPath(origin) };
}

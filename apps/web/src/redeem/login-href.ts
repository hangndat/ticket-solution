import { loginHref } from '../oidc/login-href';
import type { RedeemQueryScope } from './global-entry';

/** Preserve only the public event scope, never raw redemption codes or tokens. */
export function redeemLoginHref(scope: RedeemQueryScope): string {
  const query = new URLSearchParams();
  for (const key of [
    'tenantSlug',
    'eventSlug',
    'tenantId',
    'eventId',
  ] as const) {
    const value = scope[key]?.trim();
    if (value) query.set(key, value);
  }
  return loginHref(query.size ? `/redeem?${query}` : '/redeem');
}

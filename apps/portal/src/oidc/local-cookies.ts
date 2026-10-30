/**
 * App-local cookie names (portal process only).
 * Keep nonce/subject/platform id_token out of @ticket/web-session so we do not
 * churn the shared package for this fix.
 */
export const PORTAL_AUTH_COOKIES = {
  nonce: 'portal_oidc_nonce',
  subject: 'portal_oidc_sub',
  epoch: 'portal_staff_epoch',
  epochSnapshot: 'portal_staff_epoch_snapshot',
} as const;

export const PLATFORM_AUTH_COOKIES = {
  nonce: 'platform_oidc_nonce',
  subject: 'platform_oidc_sub',
  idToken: 'platform_oidc_id_token',
  epoch: 'portal_platform_epoch',
  epochSnapshot: 'portal_platform_epoch_snapshot',
} as const;

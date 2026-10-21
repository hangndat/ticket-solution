/**
 * App-local cookie names (web BFF only).
 * Keep subject out of @ticket/web-session to avoid churning the shared package.
 */
export const WEB_AUTH_COOKIES = {
  subject: 'web_oidc_sub',
} as const;

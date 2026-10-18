/**
 * URL schemes for the installed app.
 * - `vemoki` — product brand (ASC / home-screen name Vemoki)
 * - `ticketsolution` — legacy scheme kept for already-shipped deep links / tests
 *
 * OIDC Auth Code + PKCE and RP-initiated logout use the brand scheme
 * `vemoki://…` (Keycloak `ticket-mobile` allowlists both schemes). Custom
 * schemes are independent of web apex (`vemoki.com`) vs product
 * (`app.vemoki.com`) after O13.
 */
export const APP_SCHEMES = ['vemoki', 'ticketsolution'] as const;

export type AppScheme = (typeof APP_SCHEMES)[number];

/** Primary brand scheme for new product links and OIDC redirects. */
export const PRIMARY_APP_SCHEME: AppScheme = 'vemoki';

/**
 * OIDC Auth Code + PKCE redirect scheme (login callback).
 * Brand `vemoki` — realm already allowlists `vemoki://oauth/callback`.
 * Legacy `ticketsolution://oauth/callback` remains registered for dual-run.
 */
export const OIDC_REDIRECT_SCHEME: AppScheme = PRIMARY_APP_SCHEME;

/** Fixed post-logout redirect (must match Keycloak ticket-mobile allowlist). */
export const OIDC_POST_LOGOUT_URI = `${PRIMARY_APP_SCHEME}://oauth/logout` as const;

export function isAppScheme(protocol: string): boolean {
  const name = protocol.endsWith(':') ? protocol.slice(0, -1) : protocol;
  return (APP_SCHEMES as readonly string[]).includes(name.toLowerCase());
}

/**
 * URL schemes for the installed app.
 * - `vemoki` — product brand (ASC / home-screen name Vemoki)
 * - `ticketsolution` — legacy scheme kept for Keycloak redirect URIs and
 *   already-shipped deep links / tests on main
 */
export const APP_SCHEMES = ['vemoki', 'ticketsolution'] as const;

export type AppScheme = (typeof APP_SCHEMES)[number];

/** Primary brand scheme for new product links. */
export const PRIMARY_APP_SCHEME: AppScheme = 'vemoki';

/**
 * OIDC Auth Code + PKCE redirect scheme.
 * Keep `ticketsolution` so existing Keycloak public-client redirect URIs
 * continue to work until the IdP client is updated to accept `vemoki://…`.
 */
export const OIDC_REDIRECT_SCHEME: AppScheme = 'ticketsolution';

export function isAppScheme(protocol: string): boolean {
  const name = protocol.endsWith(':') ? protocol.slice(0, -1) : protocol;
  return (APP_SCHEMES as readonly string[]).includes(name.toLowerCase());
}

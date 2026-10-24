/** Shared production public endpoints (no secrets). Used by app.config bake and runtime guards. */
export const VEMOKI_PROD_PUBLIC = {
  apiBaseUrl: 'https://api.vemoki.com',
  oidcIssuer: 'https://auth.vemoki.com/realms/ticket',
  oidcClientId: 'ticket-mobile',
  pushProvider: 'apns',
} as const;

/** Keycloak issuer from Expo public env. Empty → fail closed (no verified user). */
export function getOidcIssuer(): string | null {
  const issuer = process.env.EXPO_PUBLIC_OIDC_ISSUER?.trim() ?? '';
  return issuer.length > 0 ? issuer.replace(/\/+$/, '') : null;
}

/** Public OIDC client id for iOS (PKCE). */
export function getOidcClientId(): string | null {
  const id = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID?.trim() ?? '';
  return id.length > 0 ? id : null;
}

export function getOidcScopes(): string {
  return (
    process.env.EXPO_PUBLIC_OIDC_SCOPES?.trim() || 'openid profile email'
  );
}

/** Nest API base URL for GET /v1/me (no trailing slash). */
export function getApiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

export function isOidcConfigured(): boolean {
  return getOidcIssuer() !== null && getOidcClientId() !== null;
}

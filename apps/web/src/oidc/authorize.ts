import { discoveryBase, type OidcWebConfig } from './config';

/** Authorization Code + PKCE URL — always requests API audience (ticket-api). */
export function buildWebAuthorizeUrl(
  config: OidcWebConfig,
  params: { state: string; nonce: string; codeChallenge: string },
): URL {
  const authorize = new URL(
    `${discoveryBase(config.issuer)}/protocol/openid-connect/auth`,
  );
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', config.scopes);
  authorize.searchParams.set('state', params.state);
  authorize.searchParams.set('nonce', params.nonce);
  authorize.searchParams.set('code_challenge', params.codeChallenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('audience', config.audience);
  return authorize;
}

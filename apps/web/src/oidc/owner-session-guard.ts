import { accessTokenIncludesAudience } from './access-token-audience';
import { isAccessTokenStaleForSsr } from './access-token-clock';
import { readOidcWebConfig } from './config';
import { readAccessToken, readRefreshToken } from './cookies';
import { redirectForSsrDiscovery401, redirectForSsrSessionRenewal } from './session-refresh';

function accessTokenReadyForSsr(token: string): boolean {
  const audience = readOidcWebConfig()?.audience ?? '';
  if (!audience) return false;
  return (
    accessTokenIncludesAudience(token, audience) &&
    !isAccessTokenStaleForSsr(token)
  );
}

/**
 * Wallet / owner SSR: refresh via route handler when refresh cookie exists;
 * guests without refresh stay on page (login CTA).
 */
export async function renewOwnerSessionIfPossible(nextPath: string): Promise<void> {
  const token = await readAccessToken();
  if (token && accessTokenReadyForSsr(token)) {
    return;
  }
  const refresh = await readRefreshToken();
  if (!refresh) {
    return;
  }
  await redirectForSsrSessionRenewal(nextPath);
}

/** After upstream 401 with owner routes — one SSR refresh attempt. */
export async function redirectOwnerDiscovery401(nextPath: string): Promise<void> {
  await redirectForSsrDiscovery401(nextPath);
}

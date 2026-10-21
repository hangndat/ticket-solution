import { decodeJwt } from 'jose';

/** SSR guard helper — matches Nest `identityVerifier` audience check (decode only). */
export function accessTokenIncludesAudience(
  token: string,
  audience: string,
): boolean {
  if (!audience.trim()) return false;
  try {
    const payload = decodeJwt(token);
    const aud = payload.aud;
    if (typeof aud === 'string') return aud === audience;
    if (Array.isArray(aud)) {
      return aud.some((v) => typeof v === 'string' && v === audience);
    }
    return false;
  } catch {
    return false;
  }
}

import { createHash, randomBytes } from 'node:crypto';

export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

export function generateOAuthState(): string {
  return base64Url(randomBytes(16));
}

/** Cryptographically random OIDC nonce (same entropy as state). */
export function generateOidcNonce(): string {
  return base64Url(randomBytes(16));
}

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

import { getProductWebOrigin } from '../identity/product-web-origin.ts';

/** Opaque membership invite token (parked on web via #token=). */
const MEMBERSHIP_INVITE_TOKEN = /^[A-Za-z0-9._~-]{8,512}$/;

export function isMembershipInviteToken(value: string): boolean {
  return MEMBERSHIP_INVITE_TOKEN.test(value.trim());
}

/**
 * Web `/invite` URL — token in fragment (matches web InviteAcceptForm parking).
 * Distinct from native `/claim` (guest event ticket).
 */
export function buildMembershipInviteWebUrl(token: string): string {
  const origin = getProductWebOrigin().replace(/\/+$/, '');
  const trimmed = token.trim();
  if (!trimmed) return `${origin}/invite`;
  return `${origin}/invite#token=${encodeURIComponent(trimmed)}`;
}

export function extractMembershipInviteTokenFromUrl(url: URL): string {
  const hash = url.hash.replace(/^#/, '');
  if (hash) {
    const params = new URLSearchParams(hash);
    const fromHash = params.get('token')?.trim() ?? '';
    if (fromHash && isMembershipInviteToken(fromHash)) return fromHash;
    if (!hash.includes('=') && isMembershipInviteToken(hash)) return hash.trim();
  }
  const fromQuery = url.searchParams.get('token')?.trim() ?? '';
  if (fromQuery && isMembershipInviteToken(fromQuery)) return fromQuery;
  return '';
}

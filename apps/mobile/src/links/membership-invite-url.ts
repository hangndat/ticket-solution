import { getProductWebOrigin } from '../identity/product-web-origin.ts';

/** Opaque membership invite token (parked on web via #token=). */
const MEMBERSHIP_INVITE_TOKEN = /^[A-Za-z0-9._~-]{8,512}$/;

export function isMembershipInviteToken(value: string): boolean {
  return MEMBERSHIP_INVITE_TOKEN.test(value.trim());
}

/** Native bridge copy only; web owns the code field and acceptance result. */
export function membershipInviteGuidance(mode: 'linked' | 'manual' | 'invalid'): string {
  if (mode === 'invalid') return 'Kiểm tra lại liên kết lời mời từ email.';
  if (mode === 'linked') return 'Hoàn tất trên trang Vemoki bằng đúng email đã được mời.';
  return 'Liên kết chưa có mã; dán mã từ thư mời vào ô Mã lời mời trên trang web, rồi đăng nhập đúng email đã được mời.';
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

let parkedToken = '';
let inviteSequence = 0;

/** Keep the opaque token out of Router URLs and navigation history. */
export function parkMembershipInviteToken(token: string): string {
  parkedToken = isMembershipInviteToken(token) ? token.trim() : '';
  return `/membership-invite?intent=${++inviteSequence}`;
}

export function peekMembershipInviteToken(): string {
  return parkedToken;
}

export function clearMembershipInviteToken(): void {
  parkedToken = '';
}

function exactOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export type InviteNavigation = 'web' | 'portal' | 'blocked';

/** Exact origins only: product pages/auth callback and the configured OIDC/Portal hosts. */
export function classifyMembershipInviteNavigation(
  raw: string,
  config: { productOrigin: string; oidcIssuer: string | null; portalOrigin?: string | null },
): InviteNavigation {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return 'blocked';
    const product = exactOrigin(config.productOrigin);
    if (!product) return 'blocked';
    if (url.origin === product) return 'web';
    if (url.searchParams.has('token') || /(?:^#|[&#])token=/i.test(url.hash)) return 'blocked';
    const oidc = config.oidcIssuer ? exactOrigin(config.oidcIssuer) : null;
    if (oidc && url.origin === oidc && url.pathname.startsWith(new URL(config.oidcIssuer!).pathname.replace(/\/$/, '') + '/')) return 'web';
    const portal = config.portalOrigin ? exactOrigin(config.portalOrigin) : null;
    if (portal && url.origin === portal) return 'portal';
    return 'blocked';
  } catch {
    return 'blocked';
  }
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

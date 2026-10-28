/**
 * Guest-facing auth notices on origin screens (Home / Redeem / …).
 * Used when OIDC cancel/fail lands via `?notice=` after `/auth` stub redirect.
 */
import { dual, pickDual } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

export type AuthNotice = {
  title: string;
  detail: string;
  retryHref: string;
};

const FAILED = {
  title: dual('Không đăng nhập được', 'Could not sign in'),
  detail: dual(
    'Phiên đăng nhập bị hủy hoặc lỗi. Thử lại, hoặc ở lại trang này.',
    'Sign-in was cancelled or failed. Try again, or stay on this page.',
  ),
};

const UNAVAILABLE = {
  title: dual('Cần đăng nhập', 'Sign in required'),
  detail: dual(
    'Đăng nhập chưa sẵn sàng trên môi trường này — không dùng phiên giả.',
    'Sign-in is not available in this environment — a fake session is not used.',
  ),
};

export function authNoticeFromParam(
  notice: string | undefined,
  options?: { retryHref?: string; locale?: AttendeeLocale },
): AuthNotice | null {
  const key = notice?.trim();
  if (!key) return null;
  const retryHref = options?.retryHref ?? '/api/auth/login?return=/';
  const locale = options?.locale ?? DEFAULT_ATTENDEE_LOCALE;

  if (
    key === 'auth_failed' ||
    key === 'access_denied' ||
    key === 'login_required' ||
    key === 'invalid_state' ||
    key === 'token_exchange' ||
    key === 'misconfigured'
  ) {
    return {
      title: pickDual(FAILED.title, locale),
      detail: pickDual(FAILED.detail, locale),
      retryHref,
    };
  }

  if (key === 'auth_unavailable') {
    return {
      title: pickDual(UNAVAILABLE.title, locale),
      detail: pickDual(UNAVAILABLE.detail, locale),
      retryHref,
    };
  }

  return null;
}

/** Append `notice` query to an allowlisted path (no open redirect). */
export function pathWithNotice(path: string, notice: string): string {
  if (path === '/') return `/?notice=${encodeURIComponent(notice)}`;
  const base = path.split('?')[0] ?? path;
  return `${base}?notice=${encodeURIComponent(notice)}`;
}

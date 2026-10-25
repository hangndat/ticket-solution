/**
 * Guest-facing auth notices on origin screens (Home / Redeem / …).
 * Used when OIDC cancel/fail lands via `?notice=` after `/auth` stub redirect.
 */

export type AuthNotice = {
  title: string;
  detail: string;
  retryHref: string;
};

export function authNoticeFromParam(
  notice: string | undefined,
  options?: { retryHref?: string },
): AuthNotice | null {
  const key = notice?.trim();
  if (!key) return null;
  const retryHref = options?.retryHref ?? '/api/auth/login?return=/';

  if (key === 'staff_check_unavailable') {
    return {
      title: 'Chưa thể xác nhận tài khoản',
      detail:
        'Hệ thống tạm thời chưa kiểm tra được quyền truy cập. Vui lòng thử đăng nhập lại.',
      retryHref,
    };
  }

  if (key === 'portal_unavailable') {
    return {
      title: 'Cổng quản trị chưa sẵn sàng',
      detail: 'Tài khoản nhân viên cần cổng quản trị. Vui lòng thử lại sau.',
      retryHref,
    };
  }

  if (
    key === 'auth_failed' ||
    key === 'access_denied' ||
    key === 'login_required' ||
    key === 'invalid_state' ||
    key === 'token_exchange' ||
    key === 'misconfigured'
  ) {
    return {
      title: 'Không đăng nhập được',
      detail: 'Phiên đăng nhập bị hủy hoặc lỗi. Thử lại, hoặc ở lại trang này.',
      retryHref,
    };
  }

  if (key === 'auth_unavailable') {
    return {
      title: 'Cần đăng nhập',
      detail:
        'Đăng nhập chưa sẵn sàng trên môi trường này — không dùng phiên giả.',
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

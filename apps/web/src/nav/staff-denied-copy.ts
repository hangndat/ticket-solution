import { type DualRunEnv, portalHref } from '../portal/dual-run';

export type StaffDeniedNotice = {
  title: string;
  detail: string;
  /** Absolute portal admin URL when PORTAL_ORIGIN is configured. */
  portalAdminHref: string | null;
};

/**
 * Soft landing copy when staff routes redirect to `/?notice=…` (O02).
 * Does not loosen guards — informational only.
 */
export function staffDeniedNotice(
  notice: string | undefined,
  env: DualRunEnv = process.env,
): StaffDeniedNotice | null {
  const key = notice?.trim();
  if (key === 'admin_denied') {
    return {
      title: 'Không đủ quyền quản trị trên app',
      detail:
        'Tài khoản này dùng để tham dự sự kiện và xem vé, không phải không gian quản trị tổ chức trên app.vemoki.com. Nếu bạn là nhân viên hoặc chủ tổ chức, đăng nhập tại portal quản trị.',
      portalAdminHref: portalHref('/admin', undefined, env),
    };
  }
  if (key === 'gate_denied') {
    return {
      title: 'Không đủ quyền cổng',
      detail:
        'Tài khoản hiện tại không được gán quyền check-in. Liên hệ chủ tổ chức nếu bạn cần vào cổng. Bạn vẫn có thể xem vé tại Vé của tôi.',
      portalAdminHref: null,
    };
  }
  return null;
}

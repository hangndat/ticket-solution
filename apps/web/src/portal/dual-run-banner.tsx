import {
  isDualRunBannerEnabled,
  portalHref,
  portalOriginFromEnv,
  type DualRunEnv,
} from './dual-run';

type Props = {
  /** Current legacy surface — used for CTA path. */
  surface?: 'admin' | 'platform';
  search?: string;
  env?: DualRunEnv;
};

/**
 * Minimal dual-run notice on legacy admin/platform (ADR-20 §8 / #438).
 * Shown when PORTAL_ORIGIN is set; redirect flag stays independent (default OFF).
 */
export function DualRunBanner({
  surface = 'admin',
  search,
  env = process.env,
}: Props) {
  if (!isDualRunBannerEnabled(env)) return null;
  const origin = portalOriginFromEnv(env);
  if (!origin) return null;

  const href =
    portalHref(surface === 'platform' ? '/platform' : '/admin', search, env) ??
    origin;

  return (
    <aside
      className="notice"
      role="status"
      data-testid="portal-dual-run-banner"
      data-portal-origin={origin}
    >
      <h2>Portal admin đang chạy song song</h2>
      <p>
        Cổng quản trị mới (Ant Design) có tại{' '}
        <a href={href} rel="noopener noreferrer">
          {origin}
        </a>
        . Trang này trên app vẫn phục vụ cho đến khi có Task deploy được ủy quyền
        riêng — redirect GET mặc định tắt.
      </p>
      <p>
        <a href={href} data-testid="portal-dual-run-cta">
          Mở trên portal →
        </a>
      </p>
      <p data-testid="portal-dual-run-gate-ios">
        Quét vé cổng chỉ trên ứng dụng <strong>Vemoki Staff</strong> (iOS) — không
        còn scanner trên web.
      </p>
    </aside>
  );
}

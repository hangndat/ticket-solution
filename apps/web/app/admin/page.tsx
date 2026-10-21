import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import {
  requireAdminCapabilityOrHome,
  requireSessionOrAuth,
} from '../../src/nav/staff-route-guard';
import { DualRunBanner } from '../../src/portal/dual-run-banner';
import { SiteNav } from '../../src/site-chrome';
import { AdminForm } from './admin-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quản trị sự kiện',
  description:
    'Tạo và cấu hình event trong tenant đã provision — metadata, publish, import, CS, export. Kết quả chưa biết không được coi là đã xong.',
};

type Props = { searchParams: Promise<{ tenantId?: string; eventId?: string }> };

export default async function Admin({ searchParams }: Props) {
  const params = await searchParams;
  await requireSessionOrAuth('/admin');
  await requireAdminCapabilityOrHome();

  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });
  // CSRF cookie is issued by GET /api/bff/me/tenants (Route Handler) when
  // AdminForm mounts — cookies().set() is illegal in RSC render (Next 15+/16 → 500).

  const bannerSearch = new URLSearchParams();
  if (params.tenantId?.trim()) bannerSearch.set('tenantId', params.tenantId.trim());
  if (params.eventId?.trim()) bannerSearch.set('eventId', params.eventId.trim());
  const bannerQs = bannerSearch.toString();

  return (
    <main id="main" className="container shell admin-page">
      <SiteNav />
      <DualRunBanner
        surface="admin"
        search={bannerQs ? `?${bannerQs}` : undefined}
      />
      <header className="admin-page-header">
        <p className="eyebrow">Quản trị tổ chức</p>
        <h1>Tổng quan quản trị</h1>
        <p className="intro admin-page-header__intro">
          Chọn tổ chức và sự kiện, rồi làm theo việc. Kết quả chưa rõ không coi
          là thành công.
        </p>
      </header>
      {!configured ? (
        <aside className="notice auth-unconfigured state-error" role="status">
          <h2>Cần cấu hình đăng nhập</h2>
          <p>
            Quản trị chưa sẵn sàng — không giả lập phiên. Đăng nhập tại{' '}
            <Link href="/auth">trang đăng nhập</Link> sau khi cấu hình xong.
          </p>
          <details className="redeem-meta">
            <summary>Chi tiết kỹ thuật</summary>
            <p>
              OIDC chưa cấu hình — quản trị fail closed, không mock session. Auth
              state:{' '}
              <strong>
                {state.status} / authenticated={String(state.authenticated)}
              </strong>
              .
            </p>
          </details>
        </aside>
      ) : null}
      <div className="admin-sections">
        <AdminForm
          initialTenantId={params.tenantId?.trim() ?? ''}
          initialEventId={params.eventId?.trim() ?? ''}
        />
      </div>
      <p className="admin-page-back">
        <Link href="/" className="textlink">← Trang chủ</Link>
      </p>
    </main>
  );
}

import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
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
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });
  // CSRF cookie is issued by GET /api/bff/me/tenants (Route Handler) when
  // AdminForm mounts — cookies().set() is illegal in RSC render (Next 15+/16 → 500).

  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="admin" />
      <h1>Không gian quản trị sự kiện</h1>
      <p className="intro">
        Làm theo việc: Chuẩn bị · Khách &amp; mã · Cổng · Hỗ trợ. Chọn tổ chức /
        sự kiện theo tên; checklist sẵn sàng dựa trên dữ liệu form thật. Shape
        sai hoặc timeout/5xx là chưa biết — không coi là thành công.
      </p>
      {!configured ? (
        <aside className="notice auth-unconfigured state-error" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Quản trị fail closed khi thiếu OIDC — không mock session. Auth
            state:{' '}
            <strong>
              {state.status} / authenticated={String(state.authenticated)}
            </strong>
            . Đăng nhập tại <Link href="/auth">/auth</Link>.
          </p>
        </aside>
      ) : null}
      <div className="admin-sections">
        <AdminForm
          initialTenantId={params.tenantId?.trim() ?? ''}
          initialEventId={params.eventId?.trim() ?? ''}
        />
      </div>
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}

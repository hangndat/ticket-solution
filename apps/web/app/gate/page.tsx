import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { SiteNav } from '../../src/site-chrome';
import { GateForm } from './gate-form';
import { GateOfflineShell } from './gate-offline-shell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cổng check-in dự phòng',
  description:
    'Cổng web — giữ chỗ và xác nhận qua API. Không cho khách qua khi kết quả chưa biết.',
};

type Props = {
  searchParams: Promise<{ tenantId?: string; eventId?: string }>;
};

export default async function GatePage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });

  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="staff" />
      <h1>Cổng check-in</h1>
      <p className="intro">
        Nhân viên đã được gán event mở phiên, giữ chỗ, rồi xác nhận. Chỉ dòng
        trạng thái «Cho qua» sau phản hồi API mới được cho khách vào. Timeout,
        mất mạng và lỗi 5xx là chưa biết — không cho khách qua. Cổng web không
        queue CHECKIN_OFFLINE; khi offline/degraded hãy dùng app iOS staff
        (ADR-18 / contract #105).
      </p>
      <GateOfflineShell suppressBanner={configured}>
        {!configured ? (
          <aside className="notice auth-unconfigured state-error" role="status">
            <h2>OIDC chưa cấu hình</h2>
            <p>
              Cổng fail closed khi thiếu OIDC — không mock session. Auth state:{' '}
              <strong>
                {state.status} / authenticated={String(state.authenticated)}
              </strong>
              . Đăng nhập tại <Link href="/auth">/auth</Link>.
            </p>
          </aside>
        ) : (
          <GateForm
            initialTenantId={params.tenantId?.trim() ?? ''}
            initialEventId={params.eventId?.trim() ?? ''}
          />
        )}
      </GateOfflineShell>
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}

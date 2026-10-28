import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { runGateStaffSsrGuards } from '../../src/nav/staff-route-guard';
import { SiteNav } from '../../src/site-chrome';
import { GateForm } from './gate-form';
import { GateOfflineShell } from './gate-offline-shell';
import { loadGateScopeChromeForPage } from './gate-scope-chrome.server';
import './gate-surface.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cổng check-in',
  description:
    'Quét, nhập tay và lịch sử cổng trên web — giữ chỗ và xác nhận qua API. Fail-closed khi mất mạng hoặc lỗi máy chủ.',
};

type Props = {
  searchParams: Promise<{ tenantId?: string; eventId?: string }>;
};

export default async function GatePage({ searchParams }: Props) {
  const params = await searchParams;
  await runGateStaffSsrGuards();
  const { scope: scopeChrome } = await loadGateScopeChromeForPage({
    tenantId: params.tenantId,
    eventId: params.eventId,
  });

  const configured = isOidcConfigured();
  const state = resolveWebAuthState({ configured, subject: null });

  return (
    <main id="main" className="container shell gate-page">
      <SiteNav />
      <h1>Cổng check-in</h1>
      <p className="intro gate-page__intro">
        Quét vé, nhập tay hoặc xem lịch sử trên trình duyệt này. Chỉ «Cho vào» sau
        phản hồi hệ thống; timeout và lỗi API là «Chưa rõ» — không cho khách qua.
      </p>
      <GateOfflineShell suppressBanner={configured}>
        {!configured ? (
          <aside className="notice auth-unconfigured state-error" role="status">
            <h2>Cần đăng nhập nhân viên</h2>
            <p>
              Cổng chưa sẵn sàng trên môi trường này — không giả lập phiên. Đăng
              nhập tại <Link href="/auth">trang đăng nhập</Link> sau khi cấu hình
              xong.
            </p>
            <details className="redeem-meta">
              <summary>Chi tiết kỹ thuật</summary>
              <p>
                OIDC chưa cấu hình — cổng fail closed, không mock session. Auth
                state:{' '}
                <strong>
                  {state.status} / authenticated={String(state.authenticated)}
                </strong>
                .
              </p>
            </details>
          </aside>
        ) : (
          <GateForm
            initialTenantId={params.tenantId?.trim() ?? ''}
            initialEventId={params.eventId?.trim() ?? ''}
            scopeChrome={scopeChrome}
          />
        )}
      </GateOfflineShell>
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}

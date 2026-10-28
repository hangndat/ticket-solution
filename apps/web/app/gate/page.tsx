import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { runGateStaffSsrGuards } from '../../src/nav/staff-route-guard';
import { SiteNav } from '../../src/site-chrome';
import {
  attendeeHomeMain,
  attendeeNoticeError,
} from '../../src/attendee-surface';
import { GateForm } from './gate-form';
import { GateOfflineShell } from './gate-offline-shell';
import { loadGateScopeChromeForPage } from './gate-scope-chrome.server';

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
    <main id="main" className={attendeeHomeMain} data-testid="gate-page">
      <SiteNav />
      <h1 className="mt-8 font-display text-[clamp(1.75rem,3.5vw,2.35rem)] font-bold tracking-[-0.03em] text-ink">
        Cổng check-in
      </h1>
      <p className="mt-3 max-w-[42rem] text-[0.98rem] leading-[1.6] text-muted">
        Quét vé, nhập tay hoặc xem lịch sử trên trình duyệt này. Chỉ «Cho vào» sau
        phản hồi hệ thống; timeout và lỗi API là «Chưa rõ» — không cho khách qua.
      </p>
      <GateOfflineShell suppressBanner={configured}>
        {!configured ? (
          <aside className={attendeeNoticeError} role="status">
            <h2>Cần đăng nhập nhân viên</h2>
            <p>
              Cổng chưa sẵn sàng trên môi trường này — không giả lập phiên. Đăng
              nhập tại <Link href="/auth">trang đăng nhập</Link> sau khi cấu hình
              xong.
            </p>
            <details className="mt-3 text-sm">
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
      <p className="mt-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline"
        >
          ← Trang chủ
        </Link>
      </p>
    </main>
  );
}

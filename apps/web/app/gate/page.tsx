import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { SiteNav } from '../../src/site-chrome';
import { GateForm } from './gate-form';
import { GateOfflineShell } from './gate-offline-shell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cổng check-in dự phòng',
  description:
    'Cổng web — giữ chỗ và xác nhận qua API. Không xếp hàng offline. Không cho khách qua khi kết quả chưa biết.',
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
        Nhân viên đã gán event mở phiên, giữ chỗ, rồi xác nhận. Chỉ trạng thái
        «Cho vào» sau phản hồi hệ thống mới được cho khách qua. Timeout, mất mạng
        và lỗi máy chủ là «Chưa rõ» — Không cho khách qua. Cổng web không xếp hàng
        offline; khi mất mạng hãy dùng app Nhân viên.
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
          />
        )}
      </GateOfflineShell>
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}

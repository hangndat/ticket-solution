import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { GateForm } from './gate-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cổng check-in dự phòng',
  description:
    'Web Gate — giữ chỗ và xác nhận qua API. Không cho khách qua khi kết quả chưa biết.',
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
      <nav aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ticket<span>↗</span>
        </Link>
        <span className="nav-links">
          <Link href="/redeem">Đổi mã</Link>
          <Link href="/auth">Identity POC</Link>
        </span>
      </nav>
      <p className="eyebrow">D3 / GATE DỰ PHÒNG · API THẬT</p>
      <h1>Cổng check-in</h1>
      <p className="intro">
        Nhân viên đã được gán event mở phiên, giữ chỗ, rồi xác nhận. Chỉ dòng
        trạng thái «Cho qua» sau phản hồi API mới được cho khách vào. Timeout,
        mất mạng và lỗi 5xx là chưa biết. Không cho khách qua.
      </p>
      {!configured ? (
        <aside className="notice auth-unconfigured" role="status">
          <h2>OIDC chưa cấu hình</h2>
          <p>
            Gate fail closed khi thiếu OIDC — không mock session. Auth state:{' '}
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
      <p>
        <Link href="/">← Demo events</Link>
      </p>
    </main>
  );
}

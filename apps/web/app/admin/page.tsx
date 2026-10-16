import Link from 'next/link';
import { isOidcConfigured, resolveWebAuthState } from '../../src/oidc/config';
import { AdminForm } from './admin-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quản trị sự kiện',
  description:
    'Lưu cấu hình, publish và nhập mã qua API. Kết quả chưa biết không được coi là đã xong.',
};

type Props = { searchParams: Promise<{ tenantId?: string; eventId?: string }> };

export default async function Admin({ searchParams }: Props) {
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
          <Link href="/gate">Cổng</Link>
        </span>
      </nav>
      <p className="eyebrow">D4 / QUẢN TRỊ · API THẬT</p>
      <h1>Cấu hình sự kiện</h1>
      <p className="intro">
        Lưu phiên bản cấu hình, xem trước payload, publish đúng phiên bản vừa
        lưu, nhập mã và đọc quota. Timeout và mất mạng là chưa biết. Không coi
        là đã lưu, đã publish, hoặc đã nhập mã. Payload đã publish không sửa
        trên form. Duyệt thủ công và báo cáo chưa có trên màn này.
      </p>
      {!configured ? (
        <aside className="notice auth-unconfigured" role="status">
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
      <AdminForm
        initialTenantId={params.tenantId?.trim() ?? ''}
        initialEventId={params.eventId?.trim() ?? ''}
      />
      <p>
        <Link href="/">← Demo events</Link>
      </p>
    </main>
  );
}

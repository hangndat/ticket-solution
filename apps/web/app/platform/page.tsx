import type { Metadata } from 'next';
import Link from 'next/link';
import { isPlatformOidcConfigured } from '../../src/platform/oidc';
import { SiteNav } from '../../src/site-chrome';
import { PlatformConsole } from './platform-console';

export const metadata: Metadata = {
  title: 'Platform console',
  description:
    'Operator: provision tenant, giới hạn, support grant (M01/M12).',
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlatformPage({ searchParams }: Props) {
  const params = await searchParams;
  const errRaw = params.error;
  const initialError = typeof errRaw === 'string' ? errRaw : undefined;
  const configured = isPlatformOidcConfigured();

  return (
    <main id="main" className="container shell redeem-page">
      <SiteNav variant="platform" />
      <h1>Platform console</h1>
      <p className="intro">
        Console Operator sau xác minh /platform/me và MFA. Không dùng ô UUID
        làm đường khám phá tenant chính (selector nằm ở Admin). Suspend /
        limits / support theo contract BE — null limits = không giới hạn.
      </p>
      {!configured ? (
        <aside className="notice state-error" role="status">
          <h2>OIDC platform chưa cấu hình</h2>
          <p>
            Thiếu biến môi trường platform OIDC — console fail closed, không
            mock quyền Operator.
          </p>
        </aside>
      ) : null}
      {initialError ? (
        <aside className="notice state-unknown" role="alert">
          <h2>Không hoàn tất đăng nhập</h2>
          <p>
            Mã lỗi: <code>{initialError}</code>. Thử đăng nhập lại hoặc kiểm tra
            MFA.
          </p>
        </aside>
      ) : null}
      <PlatformConsole
        misconfigured={!configured}
        initialError={initialError}
      />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { isPlatformOidcConfigured } from '../../src/platform/oidc';
import { PlatformConsole } from './platform-console';

export const metadata: Metadata = {
  title: 'Platform console — Vemoki',
  description: 'Operator tenant provision, limits, support grants (M01/M12).',
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlatformPage({ searchParams }: Props) {
  const params = await searchParams;
  const errRaw = params.error;
  const initialError = typeof errRaw === 'string' ? errRaw : undefined;
  const configured = isPlatformOidcConfigured();

  return (
    <main className="shell">
      <nav className="top-nav" aria-label="Chính">
        <Link href="/">Vemoki</Link>
        <Link href="/admin">Admin tenant</Link>
        <Link href="/platform">Platform</Link>
        <Link href="/invite">Nhận invite</Link>
        <Link href="/account">Tài khoản</Link>
      </nav>
      <p className="eyebrow">M01 / M12 · PLATFORM OPERATOR</p>
      <h1>Platform console</h1>
      <p className="intro">
        Console riêng sau xác minh /platform/me + MFA assurance. Không ô UUID
        làm đường vận hành chính cho tenant discovery (dùng selector ở Admin).
        Suspend/limits/support theo contract BE §6 — null limits = unlimited.
      </p>
      <PlatformConsole
        misconfigured={!configured}
        initialError={initialError}
      />
    </main>
  );
}

import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { PortalProviders } from '../src/components/providers';
import { PortalShell } from '../src/components/portal-shell';
import { readPortalLocaleFromServerCookies } from '../src/i18n/locale-server';
import { productOrigin } from '../src/oidc/config';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-portal',
});

export const metadata: Metadata = {
  title: 'Vemoki Portal',
  description: 'Cổng quản trị nhân sự Vemoki',
  // TODO(P1): localized title/description when cookie locale is EN (out of scope #566 P0-1).
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await readPortalLocaleFromServerCookies();
  return (
    <html lang={locale} className={beVietnam.variable} suppressHydrationWarning>
      <body
        style={{ fontFamily: 'var(--font-portal), sans-serif' }}
        suppressHydrationWarning
      >
        <AntdRegistry>
          <PortalProviders initialLocale={locale}>
            <PortalShell productOrigin={productOrigin()}>{children}</PortalShell>
          </PortalProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}

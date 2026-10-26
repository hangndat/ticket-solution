import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { PortalProviders } from '../src/components/providers';
import { PortalShell } from '../src/components/portal-shell';
import { readPortalLocaleFromServerCookies } from '../src/i18n/locale-server';
import { productOrigin } from '../src/oidc/config';
import './globals.css';

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
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AntdRegistry>
          <PortalProviders initialLocale={locale}>
            <PortalShell productOrigin={productOrigin()}>{children}</PortalShell>
          </PortalProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}

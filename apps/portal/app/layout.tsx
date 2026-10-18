import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { PortalProviders } from '../src/components/providers';
import { PortalShell } from '../src/components/portal-shell';
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
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body style={{ fontFamily: 'var(--font-portal), sans-serif' }}>
        <AntdRegistry>
          <PortalProviders>
            <PortalShell>{children}</PortalShell>
          </PortalProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}

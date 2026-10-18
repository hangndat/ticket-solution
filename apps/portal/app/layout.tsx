import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
export const metadata: Metadata = {
  title: 'Vemoki Portal',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}

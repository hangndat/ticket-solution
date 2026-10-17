import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Be_Vietnam_Pro, Syne } from 'next/font/google';
import './globals.css';

/**
 * Brand fonts (D6 #82):
 * - Display: Syne — geometric, expressive; used for wordmark / hero.
 * - Body: Be Vietnam Pro — readable VI + Latin; not Inter/Arial/system.
 * Colors stay O09 from brand/vemoki/tokens.json (ink/paper/signal/focus).
 */
const fontDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800'],
});

const fontBody = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: { default: 'Vemoki', template: '%s · Vemoki' },
  description:
    'Vemoki — nền tảng sự kiện. Nội dung demo mang nhãn rõ; đổi mã và cổng dùng API thật qua BFF.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${fontDisplay.variable} ${fontBody.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Bỏ qua đến nội dung
        </a>
        {children}
        <footer className="footer">
          <span className="footer-brand">
            vemoki<span aria-hidden="true">↗</span>
          </span>
          <span>Demo mang nhãn rõ · Đổi mã / cổng qua API thật</span>
        </footer>
      </body>
    </html>
  );
}

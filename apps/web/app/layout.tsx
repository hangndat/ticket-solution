import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import {
  ThemeProvider,
  VEMOKI_BRANDING,
  brandingToCssVars,
} from '../src/branding';
import { FooterBrand } from '../src/site-chrome';
import './globals.css';

/**
 * Brand fonts (D6 #82) — self-hosted via next/font/local so `next build`
 * does not fetch Google Fonts (CI / offline-safe).
 * - Display: Syne — geometric, expressive; used for wordmark / hero.
 * - Body: Be Vietnam Pro — readable VI + Latin; not Inter/Arial/system.
 * Colors stay O09 from brand/vemoki/tokens.json (ink/paper/signal/focus).
 * D8-S2: ThemeProvider applies tenant overrides when present; root = Vemoki.
 * Files + OFL notices: apps/web/fonts/
 */
const fontDisplay = localFont({
  src: '../fonts/Syne-Variable.ttf',
  variable: '--font-display',
  display: 'swap',
  weight: '600 800',
});

const fontBody = localFont({
  src: [
    {
      path: '../fonts/BeVietnamPro-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/BeVietnamPro-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/BeVietnamPro-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/BeVietnamPro-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Vemoki', template: '%s · Vemoki' },
  description:
    'Vemoki — nền tảng sự kiện. Nội dung demo mang nhãn rõ; đổi mã và cổng dùng API thật qua BFF.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const rootVars = brandingToCssVars(VEMOKI_BRANDING);
  const h = await headers();
  const surface = h.get('x-vemoki-surface');
  const locale = h.get('x-vemoki-locale') === 'en' ? 'en' : 'vi';
  const isMarketing = surface === 'marketing';

  return (
    <html
      lang={isMarketing ? locale : 'vi'}
      className={`${fontDisplay.variable} ${fontBody.variable}`}
      style={rootVars}
      data-branding-source={VEMOKI_BRANDING.source}
      data-surface={isMarketing ? 'marketing' : 'product'}
    >
      <body>
        <ThemeProvider branding={VEMOKI_BRANDING}>
          {!isMarketing ? (
            <a className="skip-link" href="#main">
              Bỏ qua đến nội dung
            </a>
          ) : (
            <a className="skip-link" href="#main">
              {locale === 'en' ? 'Skip to content' : 'Bỏ qua nội dung'}
            </a>
          )}
          {children}
          {!isMarketing ? (
            <footer className="footer">
              <FooterBrand />
              <span>Demo mang nhãn rõ · Đổi mã / cổng qua API thật</span>
            </footer>
          ) : null}
        </ThemeProvider>
      </body>
    </html>
  );
}

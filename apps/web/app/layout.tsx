import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import localFont from 'next/font/local';
import {
  ThemeProvider,
  VEMOKI_BRANDING,
  brandingToCssVars,
} from '../src/branding';
import { configuredPublicOrigin } from '../src/oidc/public-origin';
import { DemoAttendeeStrip } from '../src/attendee-uplift/demo-attendee-strip';
import { FooterBrand } from '../src/site-chrome';
import './globals.css';

/** Prod default so OG/Twitter never fall back to request-host localhost. */
const METADATA_BASE = new URL(
  configuredPublicOrigin() ?? 'https://app.vemoki.com',
);

/**
 * Brand fonts (Live Pulse v2 / #488) — self-hosted via next/font/local so
 * `next build` does not fetch Google Fonts (CI / offline-safe).
 * - Display: Sora — geometric, expressive; used for wordmark / hero.
 * - Body: Be Vietnam Pro — readable VI + Latin; not Inter/Arial/system.
 * Colors from brand/vemoki/tokens.json (ink/paper/signal/focus).
 * D8-S2: ThemeProvider applies tenant overrides when present; root = Vemoki.
 * Files + OFL notices: apps/web/fonts/
 *
 * O13: do NOT call headers() here — it forces all routes dynamic and breaks
 * `dynamicParams = false` 404 isolation for /t/[tenant]/events/[event].
 * Marketing locale/surface lives under app/marketing/layout.tsx.
 */
const fontDisplay = localFont({
  src: '../fonts/Sora-Variable.ttf',
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
  metadataBase: METADATA_BASE,
  title: { default: 'Vemoki', template: '%s · Vemoki' },
  description:
    'Vemoki — nền tảng sự kiện & vé. Đổi mã lấy vé, nhận lời mời, xem sự kiện đã xuất bản.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const rootVars = brandingToCssVars(VEMOKI_BRANDING);
  return (
    <html
      lang="vi"
      className={`${fontDisplay.variable} ${fontBody.variable}`}
      style={rootVars}
      data-branding-source={VEMOKI_BRANDING.source}
      data-surface="product"
    >
      <body className="attendee-uplift">
        <ThemeProvider branding={VEMOKI_BRANDING}>
          <a className="skip-link" href="#main">
            Bỏ qua đến nội dung
          </a>
          <DemoAttendeeStrip />
          {children}
          <footer className="footer" data-testid="site-footer">
            <FooterBrand />
            <span className="footer-tagline">Sự kiện & vé</span>
            <nav className="footer-links" aria-label="Liên kết chân trang">
              <Link href="/">Khám phá</Link>
              <Link href="/redeem">Đổi mã</Link>
              <Link href="/account">Tài khoản</Link>
            </nav>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}

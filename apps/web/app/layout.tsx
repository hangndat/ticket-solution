import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ticket · Demo events', template: '%s · Ticket demo' },
  description: 'W0 event platform foundation. Fictional demo content only.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <footer className="footer">
          TICKET / W0 FOUNDATION{' '}
          <span>Fictional fixtures. No live ticketing.</span>
        </footer>
      </body>
    </html>
  );
}

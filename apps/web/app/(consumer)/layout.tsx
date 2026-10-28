import type { ReactNode } from 'react';
import { ConsumerFooter } from '../../src/i18n';

/** Consumer product routes — attendee footer; marketing uses its own chrome (no double footer). */
export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ConsumerFooter />
    </>
  );
}

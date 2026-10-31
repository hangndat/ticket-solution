import type { Metadata } from 'next';
import { isUuid } from '../../../src/bff/ids';
import { loginHref } from '../../../src/oidc/login-href';
import { WalletClient } from '../../../src/owner-ticket/wallet-client';
import { WALLET_COPY } from '../../../src/owner-ticket/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: WALLET_COPY.title,
  description: WALLET_COPY.intro,
  robots: { index: false, follow: false },
};

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const event = (await searchParams).event?.trim() ?? '';
  return <WalletClient eventFilter={isUuid(event) ? event : null} loginHref={loginHref('/wallet')} />;
}

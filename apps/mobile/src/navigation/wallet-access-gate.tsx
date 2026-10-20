import type { ReactNode } from 'react';
import { WalletAccessNotice } from '@/components/wallet-access-notice';
import { useWalletAccess } from '@/navigation/use-wallet-access';

/**
 * Route guard for wallet stack routes. Tab is hidden without access; deep links
 * and `router.push` still resolve here.
 */
export function WalletAccessGate({ children }: { children: ReactNode }) {
  const { canAccess } = useWalletAccess();
  if (!canAccess) {
    return <WalletAccessNotice />;
  }
  return children;
}

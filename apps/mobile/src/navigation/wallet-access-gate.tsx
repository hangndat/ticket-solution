import type { ReactNode } from 'react';
import { WalletAccessNotice } from '@/components/wallet-access-notice';
import { useWalletAccess } from '@/navigation/use-wallet-access';

/** Guard wallet stack routes when tab access changes after navigation. */
export function WalletAccessGate({ children }: { children: ReactNode }) {
  const { canAccess } = useWalletAccess();
  if (!canAccess) {
    return <WalletAccessNotice />;
  }
  return children;
}

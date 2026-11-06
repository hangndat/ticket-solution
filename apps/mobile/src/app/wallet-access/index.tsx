import { Redirect, type Href } from 'expo-router';
import { useWalletAccess } from '@/navigation/use-wallet-access';
import { MyTicketsScreen } from '@/screens/my-tickets';

/** Root-stack entry for guest links; the guest NativeTabs wallet trigger is hidden. */
export default function WalletAccessRoute() {
  const { canAccess } = useWalletAccess();
  if (canAccess) {
    return <Redirect href={'/(tabs)/my-tickets' as Href} />;
  }
  return <MyTicketsScreen />;
}

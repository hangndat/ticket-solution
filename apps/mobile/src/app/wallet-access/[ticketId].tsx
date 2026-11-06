import { Redirect, type Href, useLocalSearchParams } from 'expo-router';
import { useWalletAccess } from '@/navigation/use-wallet-access';
import { MyTicketsScreen } from '@/screens/my-tickets';

/** Ticket links keep the guest wallet notice outside the hidden tab. */
export default function WalletTicketAccessRoute() {
  const { canAccess } = useWalletAccess();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  if (canAccess && typeof ticketId === 'string') {
    return <Redirect href={`/(tabs)/my-tickets/${encodeURIComponent(ticketId)}` as Href} />;
  }
  return <MyTicketsScreen />;
}

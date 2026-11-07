import { Redirect, type Href, useLocalSearchParams } from 'expo-router';
import { useWalletAccess } from '@/navigation/use-wallet-access';
import { MyTicketsScreen } from '@/screens/my-tickets';
import { TicketDetailScreen } from '@/screens/ticket-detail';

/** Ticket links keep the guest wallet notice outside the hidden tab. */
export default function WalletTicketAccessRoute() {
  const { canAccess, offlineDisplayOnly } = useWalletAccess();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  if (canAccess && typeof ticketId === 'string' && !offlineDisplayOnly) {
    return <Redirect href={`/(tabs)/my-tickets/${encodeURIComponent(ticketId)}` as Href} />;
  }
  if (canAccess && typeof ticketId === 'string') {
    return <TicketDetailScreen />;
  }
  return <MyTicketsScreen />;
}

import { WalletAccessGate } from '@/navigation/wallet-access-gate';
import { TicketDetailScreen } from '@/screens/ticket-detail';

export default function TicketDetailRoute() {
  return (
    <WalletAccessGate>
      <TicketDetailScreen />
    </WalletAccessGate>
  );
}

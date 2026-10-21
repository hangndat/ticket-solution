import { WalletAccessGate } from '@/navigation/wallet-access-gate';
import { MyTicketsScreen } from '@/screens/my-tickets';

export default function MyTicketsRoute() {
  return (
    <WalletAccessGate>
      <MyTicketsScreen />
    </WalletAccessGate>
  );
}

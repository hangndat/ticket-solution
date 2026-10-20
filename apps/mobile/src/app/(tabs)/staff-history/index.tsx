import { StaffGateTabGuard } from '@/navigation/staff-gate-tab-guard';
import { StaffHistoryScreen } from '@/screens/staff-history';

export default function StaffHistoryTabIndex() {
  return (
    <StaffGateTabGuard>
      <StaffHistoryScreen />
    </StaffGateTabGuard>
  );
}

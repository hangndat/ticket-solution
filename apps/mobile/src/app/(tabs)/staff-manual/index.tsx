import { StaffGateTabGuard } from '@/navigation/staff-gate-tab-guard';
import { StaffManualEntryScreen } from '@/screens/staff-manual';

export default function StaffManualTabIndex() {
  return (
    <StaffGateTabGuard>
      <StaffManualEntryScreen />
    </StaffGateTabGuard>
  );
}

import { StaffGateTabGuard } from '@/navigation/staff-gate-tab-guard';
import { StaffScanScreen } from '@/screens/staff-scan';

export default function StaffScanTabIndex() {
  return (
    <StaffGateTabGuard>
      <StaffScanScreen />
    </StaffGateTabGuard>
  );
}

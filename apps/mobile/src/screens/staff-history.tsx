import { ScrollView, View } from 'react-native';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateDeviceHistoryPanel } from '@/gate/staff-gate-device-history-panel';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { brand } from '@/theme/tokens';

export function StaffHistoryScreen() {
  const gate = useStaffGateWorkspace();

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      >
        <StaffGateNoEventState />
        <View>
          <StaffGateDeviceHistoryPanel rows={gate.deviceHistory} />
        </View>
      </ScrollView>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.history} largeTitle />
    </>
  );
}

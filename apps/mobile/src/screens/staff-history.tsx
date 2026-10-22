import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateDeviceHistoryPanel } from '@/gate/staff-gate-device-history-panel';
import {
  computeDeviceHistoryPageView,
  DEVICE_HISTORY_PAGE_SIZE,
  type DeviceScanHistoryRow,
} from '@/gate/staff-gate-device-history';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { brand } from '@/theme/tokens';

function StaffHistoryDeviceList({
  deviceHistory,
  scopeEventName,
}: {
  deviceHistory: DeviceScanHistoryRow[];
  scopeEventName: string | null;
}) {
  const [visibleCount, setVisibleCount] = useState(DEVICE_HISTORY_PAGE_SIZE);
  const [filterQuery, setFilterQuery] = useState('');
  const [loadMoreError, setLoadMoreError] = useState(false);

  const pageView = useMemo(
    () =>
      computeDeviceHistoryPageView(deviceHistory, visibleCount, filterQuery),
    [deviceHistory, visibleCount, filterQuery],
  );

  const handleLoadMore = () => {
    setLoadMoreError(false);
    try {
      setVisibleCount((count) => count + DEVICE_HISTORY_PAGE_SIZE);
    } catch {
      setLoadMoreError(true);
    }
  };

  const handleRetryLoadMore = () => {
    setLoadMoreError(false);
    handleLoadMore();
  };

  return (
    <StaffGateDeviceHistoryPanel
      rows={pageView.rows}
      scopeEventName={scopeEventName}
      totalAvailable={pageView.totalAvailable}
      hasMore={pageView.hasMore}
      onLoadMore={handleLoadMore}
      filterQuery={filterQuery}
      onFilterQueryChange={setFilterQuery}
      loadMoreError={loadMoreError}
      onRetryLoadMore={handleRetryLoadMore}
    />
  );
}

export function StaffHistoryScreen() {
  const gate = useStaffGateWorkspace();

  const scopeKey = gate.gateScope
    ? `${gate.gateScope.tenantId}:${gate.gateScope.eventId}`
    : 'none';

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      >
        <StaffGateNoEventState />
        <View>
          <StaffHistoryDeviceList
            key={scopeKey}
            deviceHistory={gate.deviceHistory}
            scopeEventName={gate.gateScope?.name ?? null}
          />
        </View>
      </ScrollView>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.history} largeTitle />
    </>
  );
}

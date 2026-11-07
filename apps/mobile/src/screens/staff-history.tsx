import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateDeviceHistoryPanel } from '@/gate/staff-gate-device-history-panel';
import {
  computeDeviceHistoryPageView,
  DEVICE_HISTORY_PAGE_SIZE,
  type DeviceScanHistoryRow
} from '@/gate/staff-gate-device-history';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { brand, space } from '@/theme/tokens';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

function StaffHistoryDeviceList({
  deviceHistory,
  scopeEventName,
  onImportKnownOperation
}: {
  deviceHistory: DeviceScanHistoryRow[];
  scopeEventName: string | null;
  onImportKnownOperation: (raw: string) => Promise<{
    kind: string;
    reason?: string;
    message?: string;
  }>;
}) {
  const [visibleCount, setVisibleCount] = useState(DEVICE_HISTORY_PAGE_SIZE);
  const [filterQuery, setFilterQuery] = useState('');
  const [knownOpInput, setKnownOpInput] = useState('');
  const [importKnownBusy, setImportKnownBusy] = useState(false);
  const [importKnownError, setImportKnownError] = useState<string | null>(null);
  const [importKnownInfo, setImportKnownInfo] = useState<string | null>(null);
  const [knownOpExpanded, setKnownOpExpanded] = useState(false);

  const pageView = useMemo(
    () =>
      computeDeviceHistoryPageView(deviceHistory, visibleCount, filterQuery),
    [deviceHistory, visibleCount, filterQuery],
  );

  const handleLoadMore = () => {
    setVisibleCount((count) => count + DEVICE_HISTORY_PAGE_SIZE);
  };

  const handleImportKnownOp = useCallback(async () => {
    setImportKnownError(null);
    setImportKnownInfo(null);
    setImportKnownBusy(true);
    try {
      const outcome = await onImportKnownOperation(knownOpInput);
      if (outcome.kind === 'error') {
        setImportKnownError(outcome.message ?? 'Không đối soát được mã lượt này.');
        return;
      }
      if (outcome.kind === 'noop') {
        setImportKnownInfo('Lượt này đã được ghi nhận trước đó trên máy.');
        return;
      }
      setImportKnownInfo('Đã đối soát và ghi nhận lịch sử từ máy chủ.');
      setKnownOpInput('');
    } catch {
      setImportKnownError('Không đối soát được mã lượt này. Kiểm tra kết nối và thử lại.');
    } finally {
      setImportKnownBusy(false);
    }
  }, [knownOpInput, onImportKnownOperation]);

  return (
    <StaffGateDeviceHistoryPanel
      rows={pageView.rows}
      scopeEventName={scopeEventName}
      totalAvailable={pageView.totalAvailable}
      loadedCount={pageView.loadedCount}
      hasMore={pageView.hasMore}
      onLoadMore={handleLoadMore}
      filterQuery={filterQuery}
      onFilterQueryChange={setFilterQuery}
      knownOpInput={knownOpInput}
      onKnownOpInputChange={setKnownOpInput}
      onImportKnownOp={() => void handleImportKnownOp()}
      importKnownBusy={importKnownBusy}
      importKnownError={importKnownError}
      importKnownInfo={importKnownInfo}
      knownOpExpanded={knownOpExpanded}
      onToggleKnownOp={() => setKnownOpExpanded((value) => !value)}
    />
  );
}

export function StaffHistoryScreen() {
  const gate = useStaffGateWorkspace();
  const { refreshGateEvents } = gate;
  const [pulling, setPulling] = useState(false);

  const scopeKey = gate.gateScope
    ? `${gate.gateScope.tenantId}:${gate.gateScope.eventId}`
    : 'none';

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      if (!gate.ready) {
        if (gate.workspaceLoadError) gate.retryWorkspaceLoad();
        return;
      }
      await refreshGateEvents();
    } finally {
      setPulling(false);
    }
  }, [gate, refreshGateEvents]);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.huge, gap: space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
          />
        }
      >
        <Text accessibilityRole="header" style={{ ...typography.sectionTitleBold, color: colors.label }}>
          Lịch sử
        </Text>
        {gate.ready ? <StaffGateNoEventState /> : null}
        {!gate.ready ? (
          <View style={{ gap: space.sm }}>
            <Text accessibilityRole={gate.workspaceLoadError ? 'alert' : 'text'}
              style={{ ...typography.subhead, color: gate.workspaceLoadError ? colors.deny : colors.secondary }}>
              {gate.workspaceLoadError
                ? 'Không mở được lịch sử lưu trên thiết bị.'
                : 'Đang mở lịch sử lưu trên thiết bị…'}
            </Text>
            {gate.workspaceLoadError ? (
              <Button label="Thử lại" accessibilityLabel="Thử mở lại lịch sử trên thiết bị"
                variant="secondary" onPress={() => gate.retryWorkspaceLoad()} />
            ) : null}
          </View>
        ) : null}
        {gate.ready && gate.gateScope ? <View>
          <StaffHistoryDeviceList
            key={scopeKey}
            deviceHistory={gate.deviceHistory}
            scopeEventName={gate.gateScope?.name ?? null}
            onImportKnownOperation={gate.importKnownOperation}
          />
        </View> : null}
      </ScrollView>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.history} />
    </>
  );
}

import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { radius, space } from '@/theme/tokens';
import { GateStatusStrip, StaffEventPicker } from './staff-gate-chrome.tsx';
import type { ConnectivityState } from './offline-queue.ts';
import type { GateOp } from './gate-scan.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { scanStickyStatusFromMachineLabel } from './staff-gate-scan-sticky-status.ts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function StaffGateOpsSticky({
  connectivity,
  hasSession,
  queueAttention,
  syncing,
  onSync,
  machineLabel,
  eventName,
  canSwitchEvent,
  eventPickerOpen,
  onToggleEventPicker,
  gateEventChoices,
  gateScope,
  onSelectGateScope,
  pendingOp,
  onContinueScan,
  onReconcile,
  reconcileEnabled
}: {
  connectivity: ConnectivityState;
  hasSession: boolean;
  queueAttention: boolean;
  syncing: boolean;
  onSync?: () => void;
  machineLabel: string;
  eventName: string | null;
  canSwitchEvent: boolean;
  eventPickerOpen: boolean;
  onToggleEventPicker: () => void;
  gateEventChoices: StaffGateScope[];
  gateScope: StaffGateScope | null;
  onSelectGateScope: (scope: StaffGateScope) => void;
  pendingOp: GateOp | null;
  onContinueScan?: () => void;
  onReconcile?: () => void;
  reconcileEnabled: boolean;
}) {
  const showPendingActions =
    pendingOp !== null && (reconcileEnabled || onContinueScan);
  const sticky = scanStickyStatusFromMachineLabel(machineLabel);
  const title = eventName?.trim() || 'Chưa chọn sự kiện';

  return (
    <View
      style={{
        gap: space.sm,
        paddingBottom: space.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor: colors.paper
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm
        }}
      >
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={{ ...typography.subheadSemibold, flex: 1,
            color: colors.label }}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            flexShrink: 1
          }}
          accessibilityLabel={sticky.statusText}
        >
          <Text
            style={{ ...typography.caption, 
              color: sticky.ready ? colors.admit : colors.secondary }}
          >
            ●
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...typography.caption, 
              color: sticky.ready ? colors.admit : colors.secondary }}
          >
            {sticky.statusText}
          </Text>
        </View>
        {canSwitchEvent ? (
          <Button
            variant="ghost"
            label="Đổi ›"
            accessibilityLabel={
              eventPickerOpen ? 'Đóng danh sách sự kiện' : 'Đổi sự kiện'
            }
            onPress={onToggleEventPicker}
            hitSlop={space.sm}
            style={styles.switchLink}
          />
        ) : null}
      </View>
      <GateStatusStrip
        connectivity={connectivity}
        hasSession={hasSession}
        queueAttention={queueAttention}
        syncing={syncing}
        onSync={onSync}
      />
      {eventPickerOpen && canSwitchEvent ? (
        <StaffEventPicker
          choices={gateEventChoices}
          selected={gateScope}
          onSelect={onSelectGateScope}
        />
      ) : null}
      {showPendingActions ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {reconcileEnabled ? (
            <Button
              variant="secondary"
              label="Đối soát"
              accessibilityLabel="Đối soát kết quả chưa rõ"
              onPress={onReconcile}
              style={styles.compactAction}
            />
          ) : null}
          {onContinueScan ? (
            <Button
              testID="gate-scan-continue"
              label="Quét tiếp"
              accessibilityLabel="Quét tiếp"
              onPress={onContinueScan}
              style={styles.compactAction}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchLink: { paddingVertical: space.xs, paddingHorizontal: space.xxs },
  compactAction: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    minHeight: 44
  }
});

export { buildMachineLabel } from './staff-gate-ops-sticky-label';

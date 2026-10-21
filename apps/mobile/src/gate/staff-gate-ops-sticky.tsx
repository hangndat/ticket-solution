import { Pressable, Text, View } from 'react-native';
import { GateStatusStrip, StaffEventPicker } from './staff-gate-chrome.tsx';
import type { ConnectivityState } from './offline-queue.ts';
import type { GateOp } from './gate-scan.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { scanStickyStatusFromMachineLabel } from './staff-gate-scan-sticky-status.ts';
import { colors } from '@/theme/colors';

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
  reconcileEnabled,
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
        gap: 10,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor: colors.paper,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '600',
            color: colors.label,
          }}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexShrink: 1,
          }}
          accessibilityLabel={sticky.statusText}
        >
          <Text
            style={{
              fontSize: 13,
              color: sticky.ready ? colors.admit : colors.secondary,
            }}
          >
            ●
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: sticky.ready ? colors.admit : colors.secondary,
            }}
          >
            {sticky.statusText}
          </Text>
        </View>
        {canSwitchEvent ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              eventPickerOpen ? 'Đóng danh sách sự kiện' : 'Đổi sự kiện'
            }
            onPress={onToggleEventPicker}
            hitSlop={8}
            style={{ paddingVertical: 4, paddingHorizontal: 2 }}
          >
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
              Đổi ›
            </Text>
          </Pressable>
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {reconcileEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đối soát kết quả chưa rõ"
              onPress={onReconcile}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.label, fontSize: 14 }}>Đối soát</Text>
            </Pressable>
          ) : null}
          {onContinueScan ? (
            <Pressable
              testID="gate-scan-continue"
              accessibilityRole="button"
              accessibilityLabel="Quét tiếp"
              onPress={onContinueScan}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: colors.accent,
              }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '600' }}>
                Quét tiếp
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export { buildMachineLabel } from './staff-gate-ops-sticky-label';

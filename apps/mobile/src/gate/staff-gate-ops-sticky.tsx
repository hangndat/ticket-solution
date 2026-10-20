import { Pressable, Text, View } from 'react-native';
import { GateStatusStrip } from './staff-gate-chrome.tsx';
import type { ConnectivityState } from './offline-queue.ts';
import type { GateOp } from './gate-scan.ts';
import { colors } from '@/theme/colors';

export function StaffGateOpsSticky({
  connectivity,
  hasSession,
  queueAttention,
  syncing,
  onSync,
  machineLabel,
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
  pendingOp: GateOp | null;
  onContinueScan?: () => void;
  onReconcile?: () => void;
  reconcileEnabled: boolean;
}) {
  const showPendingActions =
    pendingOp !== null && (reconcileEnabled || onContinueScan);

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
      <GateStatusStrip
        connectivity={connectivity}
        hasSession={hasSession}
        queueAttention={queueAttention}
        syncing={syncing}
        onSync={onSync}
      />
      <Text
        accessibilityRole="text"
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: colors.label,
        }}
      >
        {machineLabel}
      </Text>
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

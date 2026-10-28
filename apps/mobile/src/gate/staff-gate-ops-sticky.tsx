import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { radius, space } from '@/theme/tokens';
import { GateStatusStrip } from './staff-gate-chrome.tsx';
import { offlineConflictBannerForScope, type ConnectivityState, type OfflineQueueSnapshot } from './offline-queue.ts';
import type { GateOp } from './gate-scan.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { shortId } from './gate-outcome-copy.ts';
import { scanStickyStatusFromMachineLabel } from './staff-gate-scan-sticky-status.ts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function StaffGateOpsSticky({
  connectivity,
  hasSession,
  sessionId,
  queueSnap,
  onSync,
  machineLabel,
  eventName,
  hideEventTitle = false,
  gateScope,
  pendingOp,
  onContinueScan,
  onReconcile,
  reconcileEnabled
}: {
  connectivity: ConnectivityState;
  hasSession: boolean;
  sessionId?: string | null;
  queueSnap: OfflineQueueSnapshot;
  onSync?: () => void;
  machineLabel: string;
  eventName: string | null;
  /** Header chrome already shows the active event; skip the duplicate title. */
  hideEventTitle?: boolean;
  gateScope: StaffGateScope | null;
  pendingOp: GateOp | null;
  onContinueScan?: () => void;
  onReconcile?: () => void;
  reconcileEnabled: boolean;
}) {
  const showPendingActions =
    pendingOp !== null && (reconcileEnabled || onContinueScan);
  const sticky = scanStickyStatusFromMachineLabel(machineLabel);
  const title = eventName?.trim() || 'Chưa chọn sự kiện';
  const conflictBanner = offlineConflictBannerForScope(queueSnap, gateScope, connectivity);

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
        {hideEventTitle ? (
          <View style={{ flex: 1 }} />
        ) : (
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            style={{ ...typography.subheadSemibold, flex: 1,
              color: colors.label }}
          >
            {title}
          </Text>
        )}
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
      </View>
      <Text
        numberOfLines={1}
        style={{ ...typography.caption, color: colors.secondary }}
        accessibilityLabel={`${hideEventTitle && eventName?.trim() ? `${eventName.trim()}. ` : ''}${
          hasSession
            ? `Phiên cổng ${shortId(sessionId, 8)}`
            : 'Chưa mở phiên cổng'
        }`}
      >
        {hasSession
          ? `Phiên cổng · ${shortId(sessionId, 8)}`
          : 'Chưa mở phiên cổng'}
      </Text>
      <GateStatusStrip
        connectivity={connectivity}
        hasSession={hasSession}
        queueAttention={queueSnap.pendingCount > 0 || queueSnap.conflictCount > 0}
        syncing={queueSnap.syncing}
        onSync={onSync}
      />
      {conflictBanner ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={`${conflictBanner.title}. ${conflictBanner.body}`}
          style={{
            padding: space.sm,
            gap: space.xxs,
            backgroundColor: colors.card,
            borderLeftWidth: 3,
            borderLeftColor: colors.deny,
            borderRadius: radius.sm,
            borderCurve: 'continuous',
          }}
        >
          <Text style={{ ...typography.subheadSemibold, color: colors.deny }}>
            {conflictBanner.title}
          </Text>
          <Text style={{ ...typography.caption, color: colors.secondary }}>
            {conflictBanner.body}
          </Text>
        </View>
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
  compactAction: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    minHeight: 44
  }
});

export { buildMachineLabel } from './staff-gate-ops-sticky-label';

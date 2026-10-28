import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Button } from '@/components/ui/button';
import { radius, space } from '@/theme/tokens';
import { offlineConflictBannerForScope, type ConnectivityState, type OfflineQueueSnapshot } from './offline-queue.ts';
import type { GateOp } from './gate-scan.ts';
import type { StaffGateScope } from './staff-gate-events.ts';
import { scanStickyStatus } from './staff-gate-scan-sticky-status.ts';
import {
  statusIconInfo,
  visibleStatusIcons,
  type StatusIconInfo,
} from './staff-gate-status-icons.ts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

function iconTint(tone: StatusIconInfo['tone']): string {
  if (tone === 'ok') return colors.admit;
  if (tone === 'attention') return colors.unknown;
  return colors.secondary;
}

/**
 * One status line: dot + status on the left (truncates), tappable status icons
 * on the right. The event name lives in the native header only.
 */
export function StaffGateOpsSticky({
  connectivity,
  hasSession,
  gateName,
  queueSnap,
  onSync,
  machineLabel,
  eventName,
  gateScope,
  pendingOp,
  onContinueScan,
  onReconcile,
  reconcileEnabled
}: {
  connectivity: ConnectivityState;
  hasSession: boolean;
  /** Gate of the open session (O31); null when none/legacy. */
  gateName?: string | null;
  queueSnap: OfflineQueueSnapshot;
  onSync?: () => void;
  machineLabel: string;
  /** Accessibility label only — the header already shows the event. */
  eventName: string | null;
  gateScope: StaffGateScope | null;
  pendingOp: GateOp | null;
  onContinueScan?: () => void;
  onReconcile?: () => void;
  reconcileEnabled: boolean;
}) {
  const showPendingActions =
    pendingOp !== null && (reconcileEnabled || onContinueScan);
  const sticky = scanStickyStatus({ machineLabel, hasSession, gateName });
  const conflictBanner = offlineConflictBannerForScope(queueSnap, gateScope, connectivity);
  const dotColor =
    sticky.tone === 'ready' ? colors.admit : colors.secondary;
  const iconInput = {
    connectivity,
    hasSession,
    gateName,
    pendingCount: queueSnap.pendingCount,
    conflictCount: queueSnap.conflictCount,
    syncing: queueSnap.syncing,
  };
  const icons = visibleStatusIcons(iconInput).map((id) =>
    statusIconInfo(id, iconInput),
  );
  const event = eventName?.trim();

  const explain = (info: StatusIconInfo) => {
    if (info.id === 'sync' && onSync && !queueSnap.syncing) {
      Alert.alert(info.title, info.message, [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Đồng bộ ngay', onPress: onSync },
      ]);
      return;
    }
    Alert.alert(info.title, info.message, [{ text: 'Đóng' }]);
  };

  return (
    <View
      style={{
        gap: space.sm,
        paddingBottom: space.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor: colors.paper
      }}
    >
      <View style={styles.line}>
        <View
          style={styles.statusLeft}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${event ? `${event}. ` : ''}${sticky.statusText}`}
        >
          <Text style={{ ...typography.caption, color: dotColor }}>●</Text>
          <Text
            numberOfLines={1}
            style={{ ...typography.caption, color: dotColor, flexShrink: 1 }}
          >
            {sticky.statusText}
          </Text>
        </View>
        <View style={styles.iconsRight}>
          {icons.map((info) => (
            <Pressable
              key={info.id}
              testID={`gate-status-icon-${info.id}`}
              accessibilityRole="button"
              accessibilityLabel={info.accessibilityLabel}
              accessibilityHint={info.accessibilityHint}
              hitSlop={space.xs}
              onPress={() => explain(info)}
              style={styles.iconTap}
            >
              <SymbolView
                name={info.symbol}
                size={22}
                tintColor={iconTint(info.tone)}
              />
            </Pressable>
          ))}
        </View>
      </View>
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
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44
  },
  statusLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm
  },
  iconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs
  },
  iconTap: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  compactAction: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    minHeight: 44
  }
});

export { buildMachineLabel } from './staff-gate-ops-sticky-label';

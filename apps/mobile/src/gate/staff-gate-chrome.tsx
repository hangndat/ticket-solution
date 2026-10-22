import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SymbolView } from 'expo-symbols';
import type { GatePhase } from '@/gate/gate-scan';
import type { ConnectivityState } from '@/gate/offline-queue';
import {
  sameStaffGateScope,
  type StaffGateScope,
} from '@/gate/staff-gate-events';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

type OutcomeGlyph = 'idle' | 'busy' | 'admit' | 'deny' | 'unknown' | 'default';

export function gateOutcomeGlyph(
  busy: boolean,
  phase: GatePhase | undefined,
  tone: 'admit' | 'deny' | 'unknown' | 'default',
): OutcomeGlyph {
  if (busy) return 'busy';
  if (!phase) return 'idle';
  if (tone === 'admit' || phase === 'admitted') return 'admit';
  if (tone === 'deny' || phase === 'denied') return 'deny';
  if (tone === 'unknown' || phase === 'unknown' || phase === 'queued') {
    return 'unknown';
  }
  if (phase === 'confirming' || phase === 'holding') return 'busy';
  return 'default';
}

export function GateStatusStrip({
  connectivity,
  hasSession,
  queueAttention,
  syncing,
  onSync
}: {
  connectivity: ConnectivityState;
  hasSession: boolean;
  queueAttention: boolean;
  syncing: boolean;
  onSync?: () => void;
}) {
  const wifi =
    connectivity === 'online'
      ? 'wifi'
      : connectivity === 'offline'
        ? 'wifi.slash'
        : 'wifi.exclamationmark';
  const wifiColor =
    connectivity === 'online' ? colors.admit : colors.secondary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
      <SymbolView
        name={wifi}
        size={22}
        tintColor={wifiColor}
        accessibilityLabel={
          connectivity === 'online'
            ? 'Trực tuyến'
            : connectivity === 'offline'
              ? 'Ngoại tuyến'
              : 'Mạng chưa rõ'
        }
      />
      <SymbolView
        name={hasSession ? 'person.crop.circle.badge.checkmark' : 'person.crop.circle'}
        size={22}
        tintColor={hasSession ? colors.admit : colors.secondary}
        accessibilityLabel={
          hasSession ? 'Đã mở phiên cổng' : 'Chưa mở phiên cổng'
        }
      />
      {queueAttention ? (
        <Button
          variant="ghost"
          accessibilityLabel="Đồng bộ hàng đợi offline"
          disabled={syncing}
          loading={syncing}
          onPress={onSync}
          hitSlop={space.sm}
          style={styles.iconTap}
        >
          {syncing ? null : (
            <SymbolView
              name="arrow.triangle.2.circlepath"
              size={22}
              tintColor={colors.unknown}
            />
          )}
        </Button>
      ) : null}
    </View>
  );
}

export function StaffEventRow({
  scope,
  loading,
  canSwitch,
  pickerOpen,
  onTogglePicker
}: {
  scope: StaffGateScope | null;
  loading: boolean;
  canSwitch: boolean;
  pickerOpen: boolean;
  onTogglePicker: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {loading ? (
        <Spinner style={styles.rowSpinner} color={colors.secondary} />
      ) : (
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={{ ...typography.bodySemibold, color: colors.label, }}
        >
          {scope?.name ?? '—'}
        </Text>
      )}
      {canSwitch ? (
        <Button
          variant="secondary"
          accessibilityLabel={pickerOpen ? 'Đóng danh sách sự kiện' : 'Đổi sự kiện'}
          onPress={onTogglePicker}
          hitSlop={space.sm}
          style={styles.switchEvent}
        >
          <SymbolView
            name="arrow.left.arrow.right"
            size={18}
            tintColor={colors.accent}
          />
        </Button>
      ) : null}
    </View>
  );
}

export function StaffEventPicker({
  choices,
  selected,
  onSelect
}: {
  choices: StaffGateScope[];
  selected: StaffGateScope | null;
  onSelect: (scope: StaffGateScope) => void;
}) {
  if (choices.length === 0) return null;
  return (
    <View style={{ gap: space.xs }}>
      {choices.map((choice) => {
        const active =
          selected !== null && sameStaffGateScope(selected, choice);
        return (
          <Button
            key={`${choice.tenantId}:${choice.eventId}`}
            variant="ghost"
            accessibilityState={{ selected: active }}
            accessibilityLabel={choice.name}
            onPress={() => onSelect(choice)}
            style={[
              styles.pickerRow,
              active ? styles.pickerRowActive : null,
            ]}
            contentStyle={styles.pickerRowContent}
          >
            <Text
              numberOfLines={1}
              style={{ ...typography.callout, color: colors.label,
                fontWeight: active ? '700' : '400' }}
            >
              {choice.name}
            </Text>
          </Button>
        );
      })}
    </View>
  );
}

export function GateOutcomeGlyph({
  kind,
  accessibilityTitle,
  accessibilityDetail
}: {
  kind: OutcomeGlyph;
  accessibilityTitle: string;
  accessibilityDetail: string;
}) {
  if (kind === 'idle') return null;

  const size = 56;
  type OutcomeSymbol =
    | 'checkmark.circle.fill'
    | 'xmark.circle.fill'
    | 'questionmark.circle.fill'
    | 'ellipsis.circle.fill';
  let symbol: OutcomeSymbol = 'ellipsis.circle.fill';
  let tint: string = colors.secondary;

  if (kind === 'busy') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${accessibilityTitle}. ${accessibilityDetail}`}
        style={{ alignItems: 'center', paddingVertical: space.xs }}
      >
        <Spinner size="large" color={colors.accent} />
      </View>
    );
  }
  if (kind === 'admit') {
    symbol = 'checkmark.circle.fill';
    tint = colors.admit;
  } else if (kind === 'deny') {
    symbol = 'xmark.circle.fill';
    tint = colors.deny;
  } else if (kind === 'unknown') {
    symbol = 'questionmark.circle.fill';
    tint = colors.unknown;
  } else {
    symbol = 'ellipsis.circle.fill';
    tint = colors.secondary;
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${accessibilityTitle}. ${accessibilityDetail}`}
      style={{ alignItems: 'center', paddingVertical: space.xs }}
    >
      <SymbolView name={symbol} size={size} tintColor={tint} />
    </View>
  );
}

type GateIconSymbol =
  | 'doc.on.clipboard'
  | 'keyboard'
  | 'arrow.clockwise'
  | 'clock.arrow.circlepath';

export function GateHistoryIconButton({
  count,
  disabled,
  onPress
}: {
  count: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const label =
    count > 0
      ? `Lịch sử quét trên máy, ${count} mục gần đây`
      : 'Lịch sử quét trên máy';
  return (
    <View>
      <GateIconButton
        symbol="clock.arrow.circlepath"
        label={label}
        disabled={disabled}
        onPress={onPress}
        testID="gate-history-button"
      />
      {count > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: radius.sm,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space.xs
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            style={{ ...typography.badge, color: colors.onAccent, }}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function GateIconButton({
  symbol,
  label,
  disabled,
  onPress,
  filled,
  testID
}: {
  symbol: GateIconSymbol;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  filled?: boolean;
  testID?: string;
}) {
  return (
    <Button
      testID={testID}
      variant={filled ? 'primary' : 'secondary'}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={styles.gateIcon}
      contentStyle={styles.gateIconContent}
    >
      <SymbolView
        name={symbol}
        size={22}
        tintColor={filled ? colors.onAccent : colors.label}
      />
    </Button>
  );
}

const styles = StyleSheet.create({
  iconTap: {
    minHeight: 44,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs
  },
  rowSpinner: { flex: 1 },
  switchEvent: {
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
    minHeight: 44
  },
  pickerRow: {
    alignSelf: 'stretch',
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.sm + 2
  },
  pickerRowActive: {
    backgroundColor: colors.card
  },
  pickerRowContent: {
    justifyContent: 'flex-start',
    width: '100%'
  },
  gateIcon: {
    width: 48,
    height: 48,
    minHeight: 48,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: radius.md
  },
  gateIconContent: {
    padding: 0
  }
});

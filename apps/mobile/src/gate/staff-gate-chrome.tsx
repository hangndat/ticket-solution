import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { GatePhase } from '@/gate/gate-scan';
import type { ConnectivityState } from '@/gate/offline-queue';
import type { StaffGateScope } from '@/gate/staff-gate-events';
import { sameStaffGateScope } from '@/gate/staff-gate-events';
import { colors } from '@/theme/colors';

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
  onSync,
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đồng bộ hàng đợi offline"
          disabled={syncing}
          onPress={onSync}
          hitSlop={8}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <SymbolView
              name="arrow.triangle.2.circlepath"
              size={22}
              tintColor={colors.unknown}
            />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function StaffEventRow({
  scope,
  loading,
  canSwitch,
  pickerOpen,
  onTogglePicker,
}: {
  scope: StaffGateScope | null;
  loading: boolean;
  canSwitch: boolean;
  pickerOpen: boolean;
  onTogglePicker: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.secondary} />
      ) : (
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={{
            flex: 1,
            color: colors.label,
            fontSize: 17,
            fontWeight: '600',
          }}
        >
          {scope?.name ?? '—'}
        </Text>
      )}
      {canSwitch ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pickerOpen ? 'Đóng danh sách sự kiện' : 'Đổi sự kiện'}
          onPress={onTogglePicker}
          hitSlop={8}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.card,
          }}
        >
          <SymbolView
            name="arrow.left.arrow.right"
            size={18}
            tintColor={colors.accent}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StaffEventPicker({
  choices,
  selected,
  onSelect,
}: {
  choices: StaffGateScope[];
  selected: StaffGateScope | null;
  onSelect: (scope: StaffGateScope) => void;
}) {
  if (choices.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      {choices.map((choice) => {
        const active =
          selected !== null && sameStaffGateScope(selected, choice);
        return (
          <Pressable
            key={`${choice.tenantId}:${choice.eventId}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={choice.name}
            onPress={() => onSelect(choice)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: active ? colors.card : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: colors.label,
                fontSize: 16,
                fontWeight: active ? '700' : '400',
              }}
            >
              {choice.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function GateOutcomeGlyph({
  kind,
  accessibilityTitle,
  accessibilityDetail,
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
        style={{ alignItems: 'center', paddingVertical: 4 }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
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
      style={{ alignItems: 'center', paddingVertical: 4 }}
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
  onPress,
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
            borderRadius: 9,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            style={{
              color: colors.onAccent,
              fontSize: 11,
              fontWeight: '700',
            }}
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
  testID,
}: {
  symbol: GateIconSymbol;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  filled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.accent : colors.card,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <SymbolView
        name={symbol}
        size={22}
        tintColor={filled ? colors.onAccent : colors.label}
      />
    </Pressable>
  );
}

import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  formatDeviceHistoryTime,
  type DeviceScanHistoryRow,
} from './staff-gate-device-history.ts';
import { colors } from '@/theme/colors';

function rowTint(tone: DeviceScanHistoryRow['tone']): string {
  if (tone === 'admit') return colors.admit;
  if (tone === 'deny') return colors.deny;
  if (tone === 'unknown') return colors.unknown;
  return colors.secondary;
}

export function StaffGateDeviceHistoryPanel({
  rows,
  hideTitle = false,
}: {
  rows: DeviceScanHistoryRow[];
  hideTitle?: boolean;
}) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="summary">
      {hideTitle ? null : (
        <View style={{ gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.label,
              fontSize: 17,
              fontWeight: '600',
            }}
          >
            Lịch sử trên máy này
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>
            Chỉ các lượt quét lưu trên thiết bị — không phải toàn hệ thống.
          </Text>
        </View>
      )}
      {rows.length === 0 ? (
        <Text style={{ color: colors.secondary, fontSize: 15 }}>
          Chưa có lượt quét gần đây cho sự kiện này.
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {rows.map((row) => (
            <View
              key={row.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.card,
              }}
              accessibilityLabel={`${formatDeviceHistoryTime(row.at)}. Vé ${row.ticketLabel}. ${row.statusLabel}. ${row.hint}`}
            >
              <SymbolView
                name={
                  row.source === 'offline-queue'
                    ? 'tray.full.fill'
                    : 'qrcode.viewfinder'
                }
                size={18}
                tintColor={rowTint(row.tone)}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.label,
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  >
                    {row.statusLabel}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 13 }}>
                    {formatDeviceHistoryTime(row.at)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.secondary, fontSize: 13 }}
                >
                  {row.ticketLabel}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

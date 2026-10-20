import { Pressable, Text, TextInput, View } from 'react-native';
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

export type StaffGateDeviceHistoryPanelProps = {
  rows: DeviceScanHistoryRow[];
  hideTitle?: boolean;
  totalAvailable?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  filterQuery?: string;
  onFilterQueryChange?: (value: string) => void;
  loadMoreError?: boolean;
  onRetryLoadMore?: () => void;
};

export function StaffGateDeviceHistoryPanel({
  rows,
  hideTitle = false,
  totalAvailable = 0,
  hasMore = false,
  onLoadMore,
  filterQuery = '',
  onFilterQueryChange,
  loadMoreError = false,
  onRetryLoadMore,
}: StaffGateDeviceHistoryPanelProps) {
  const paginationEnabled =
    onFilterQueryChange !== undefined || onLoadMore !== undefined;
  const renderedCount = rows.length;
  const showSearch = onFilterQueryChange !== undefined;
  const showFooter = paginationEnabled && totalAvailable > 0;

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
      {showSearch ? (
        <TextInput
          value={filterQuery}
          onChangeText={onFilterQueryChange}
          placeholder="Tìm trong các lượt đã tải"
          placeholderTextColor={colors.secondary}
          accessibilityLabel="Tìm trong các lượt đã tải"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={{
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.card,
            color: colors.label,
            fontSize: 16,
          }}
        />
      ) : null}
      {totalAvailable === 0 ? (
        <Text style={{ color: colors.secondary, fontSize: 15 }}>
          {paginationEnabled
            ? 'Chưa có lượt quét trên thiết bị này.'
            : 'Chưa có lượt quét gần đây cho sự kiện này.'}
        </Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: colors.secondary, fontSize: 15 }}>
          Không có lượt quét khớp với từ khóa trong các lượt đã tải.
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
      {showFooter ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          {loadMoreError ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.deny, fontSize: 14, lineHeight: 20 }}>
                Không tải được lượt tiếp theo. Các lượt đã tải vẫn được giữ.
              </Text>
              {onRetryLoadMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Thử tải thêm lượt quét"
                  onPress={onRetryLoadMore}
                  style={{
                    alignSelf: 'flex-start',
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                  }}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>
                    Thử lại
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : hasMore && onLoadMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tải thêm lượt quét"
              onPress={onLoadMore}
              style={{
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>
                Tải thêm lượt quét
              </Text>
            </Pressable>
          ) : !hasMore ? (
            <Text style={{ color: colors.secondary, fontSize: 14, textAlign: 'center' }}>
              Đã xem hết lịch sử lưu trên máy này
            </Text>
          ) : null}
          <Text
            style={{ color: colors.secondary, fontSize: 13, textAlign: 'center' }}
            accessibilityLabel={`Đã tải ${renderedCount} lượt`}
          >
            Đã tải {renderedCount} lượt
          </Text>
        </View>
      ) : null}
    </View>
  );
}

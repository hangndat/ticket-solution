import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { radius, space } from '@/theme/tokens';
import { SymbolView } from 'expo-symbols';
import {
  formatDeviceHistoryTime,
  groupDeviceHistoryByDay,
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
  scopeEventName?: string | null;
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
  scopeEventName = null,
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
            {scopeEventName?.trim()
              ? `Trên thiết bị này · ${scopeEventName.trim()}`
              : 'Chỉ các lượt quét lưu trên thiết bị — không phải toàn hệ thống.'}
          </Text>
        </View>
      )}
      {showSearch ? (
        <Input
          value={filterQuery}
          onChangeText={onFilterQueryChange}
          placeholder="Tìm trong các lượt đã tải"
          accessibilityLabel="Tìm trong các lượt đã tải"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
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
        <View style={{ gap: 12 }}>
          {groupDeviceHistoryByDay(rows).map((section) => (
            <View key={section.dayKey} style={{ gap: 6 }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.secondary,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {section.headerLabel}
              </Text>
              {section.rows.map((row) => (
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
                <Button
                  variant="secondary"
                  label="Thử lại"
                  accessibilityLabel="Thử tải thêm lượt quét"
                  onPress={onRetryLoadMore}
                  style={styles.retryBtn}
                />
              ) : null}
            </View>
          ) : hasMore && onLoadMore ? (
            <Button
              variant="secondary"
              label="Tải thêm lượt quét"
              accessibilityLabel="Tải thêm lượt quét"
              onPress={onLoadMore}
            />
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

const styles = StyleSheet.create({
  retryBtn: { alignSelf: 'flex-start' },
});

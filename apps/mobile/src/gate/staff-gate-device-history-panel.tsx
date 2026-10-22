import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { radius, space } from '@/theme/tokens';
import { SymbolView } from 'expo-symbols';
import {
  formatDeviceHistoryTime,
  groupDeviceHistoryByDay,
  type DeviceScanHistoryRow
} from './staff-gate-device-history.ts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

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
  onRetryLoadMore
}: StaffGateDeviceHistoryPanelProps) {
  const paginationEnabled =
    onFilterQueryChange !== undefined || onLoadMore !== undefined;
  const renderedCount = rows.length;
  const showSearch = onFilterQueryChange !== undefined;
  const showFooter = paginationEnabled && totalAvailable > 0;

  return (
    <View style={{ gap: space.sm }} accessibilityRole="summary">
      {hideTitle ? null : (
        <View style={{ gap: space.xxs }}>
          <Text
            accessibilityRole="header"
            style={{ ...typography.bodySemibold, color: colors.label, }}
          >
            Lịch sử trên máy này
          </Text>
          <Text style={{ ...typography.caption, color: colors.secondary }}>
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
        <Text style={{ ...typography.subhead, color: colors.secondary }}>
          {paginationEnabled
            ? 'Chưa có lượt quét trên thiết bị này.'
            : 'Chưa có lượt quét gần đây cho sự kiện này.'}
        </Text>
      ) : rows.length === 0 ? (
        <Text style={{ ...typography.subhead, color: colors.secondary }}>
          Không có lượt quét khớp với từ khóa trong các lượt đã tải.
        </Text>
      ) : (
        <View style={{ gap: space.md }}>
          {groupDeviceHistoryByDay(rows).map((section) => (
            <View key={section.dayKey} style={{ gap: space.sm }}>
              <Text
                accessibilityRole="header"
                style={{ ...typography.caption, color: colors.secondary, }}
              >
                {section.headerLabel}
              </Text>
              {section.rows.map((row) => (
                <View
                  key={row.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: space.sm,
                    paddingVertical: space.sm,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.card
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
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: space.sm
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ ...typography.subheadSemibold, color: colors.label, }}
                      >
                        {row.statusLabel}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.secondary }}>
                        {formatDeviceHistoryTime(row.at)}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ ...typography.caption, color: colors.secondary }}
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
        <View style={{ gap: space.md, marginTop: space.xs }}>
          {loadMoreError ? (
            <View style={{ gap: space.sm }}>
              <Text style={{ ...typography.footnote, color: colors.deny,  lineHeight: 20 }}>
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
            <Text style={{ ...typography.footnote, color: colors.secondary,  textAlign: 'center' }}>
              Đã xem hết lịch sử lưu trên máy này
            </Text>
          ) : null}
          <Text
            style={{ ...typography.caption, color: colors.secondary,  textAlign: 'center' }}
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
  retryBtn: { alignSelf: 'flex-start' }
});

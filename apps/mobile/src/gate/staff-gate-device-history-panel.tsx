import { useState } from 'react';
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
  if (tone === 'warning') return colors.warning;
  if (tone === 'unknown') return colors.unknown;
  return colors.secondary;
}

export type StaffGateDeviceHistoryPanelProps = {
  rows: DeviceScanHistoryRow[];
  scopeEventName?: string | null;
  hideTitle?: boolean;
  totalAvailable?: number;
  loadedCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  filterQuery?: string;
  onFilterQueryChange?: (value: string) => void;
  loadMoreError?: boolean;
  onRetryLoadMore?: () => void;
  knownOpInput?: string;
  onKnownOpInputChange?: (value: string) => void;
  onImportKnownOp?: () => void;
  importKnownBusy?: boolean;
  importKnownError?: string | null;
  importKnownInfo?: string | null;
  knownOpExpanded?: boolean;
  onToggleKnownOp?: () => void;
};

function HistoryRow({ row }: { row: DeviceScanHistoryRow }) {
  const [expanded, setExpanded] = useState(false);
  return <Button
    variant="ghost"
    onPress={() => setExpanded((value) => !value)}
    accessibilityState={{ expanded }}
    accessibilityLabel={`${formatDeviceHistoryTime(row.at)}. Vé ${row.ticketLabel}. ${row.statusLabel}. ${expanded ? 'Ẩn' : 'Xem'} mã lượt đầy đủ`}
    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
      paddingVertical: space.sm, paddingHorizontal: space.md, minHeight: 52,
      backgroundColor: colors.paper }}>
    <SymbolView name={row.source === 'offline-queue' ? 'tray.full.fill' : 'qrcode.viewfinder'}
      size={18} tintColor={rowTint(row.tone)} />
    <View style={{ flex: 1, gap: space.xxs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Text numberOfLines={1} style={{ ...typography.subheadSemibold, color: colors.label, flex: 1 }}>{row.statusLabel}</Text>
        <Text style={{ ...typography.caption, color: colors.secondary }}>{formatDeviceHistoryTime(row.at)}</Text>
      </View>
      <Text numberOfLines={1} style={{ ...typography.caption, color: colors.secondary }}>
        Vé {row.ticketLabel} · Mã lượt {row.operationLabel}
      </Text>
      {expanded ? <View style={{ gap: space.xxs, paddingTop: space.xs }}>
        <Text selectable style={{ ...typography.caption, color: colors.secondary }}>Mã lượt: {row.operationIdFull ?? row.operationLabel}</Text>
        {row.receiptIdFull ? <Text selectable style={{ ...typography.caption, color: colors.secondary }}>Biên nhận: {row.receiptIdFull}</Text> : null}
        <Text style={{ ...typography.caption, color: colors.secondary }}>{row.hint}</Text>
      </View> : null}
    </View>
    <SymbolView name={expanded ? 'chevron.up' : 'chevron.down'} size={13} tintColor={colors.secondary} />
  </Button>;
}

export function StaffGateDeviceHistoryPanel({
  rows,
  scopeEventName = null,
  hideTitle = false,
  totalAvailable = 0,
  loadedCount = rows.length,
  hasMore = false,
  onLoadMore,
  filterQuery = '',
  onFilterQueryChange,
  loadMoreError = false,
  onRetryLoadMore,
  knownOpInput = '',
  onKnownOpInputChange,
  onImportKnownOp,
  importKnownBusy = false,
  importKnownError = null,
  importKnownInfo = null,
  knownOpExpanded = false,
  onToggleKnownOp
}: StaffGateDeviceHistoryPanelProps) {
  const paginationEnabled =
    onFilterQueryChange !== undefined || onLoadMore !== undefined;
  const showSearch = onFilterQueryChange !== undefined;
  const showFooter = paginationEnabled && totalAvailable > 0;
  const showKnownOpImport =
    onKnownOpInputChange !== undefined && onImportKnownOp !== undefined;

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
        <>
        <Input
          value={filterQuery}
          onChangeText={onFilterQueryChange}
          placeholder="Tìm vé hoặc trạng thái"
          accessibilityLabel="Tìm trong các lượt đã tải"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Text style={{ ...typography.caption, color: colors.secondary }}>
          Chỉ tìm trong {loadedCount} lượt đã tải
        </Text>
        </>
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
              <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
                {section.rows.map((row, index) => <View key={row.id} style={index ? { borderTopWidth: 1, borderTopColor: colors.separator } : undefined}>
                  <HistoryRow row={row} />
                </View>)}
              </View>
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
            accessibilityLabel={`Đã tải ${loadedCount} lượt`}
          >
            Đã tải {loadedCount} lượt
          </Text>
        </View>
      ) : null}
      {showKnownOpImport ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button label={knownOpExpanded ? 'Ẩn đối soát mã lượt đã biết' : 'Đối soát mã lượt đã biết'}
            variant="secondary" accessibilityLabel={knownOpExpanded ? 'Ẩn đối soát mã lượt đã biết' : 'Mở đối soát mã lượt đã biết'}
            onPress={onToggleKnownOp} />
          {knownOpExpanded ? <>
            <Text style={{ ...typography.caption, color: colors.secondary }}>Nhập mã lượt UUID từ biên nhận đồng bộ. Chỉ đối soát trong sự kiện đang chọn; đây không phải ô tìm vé.</Text>
            <Input value={knownOpInput} onChangeText={onKnownOpInputChange} placeholder="Mã lượt UUID"
              accessibilityLabel="Mã lượt UUID đã biết" autoCapitalize="none" autoCorrect={false}
              clearButtonMode="while-editing" editable={!importKnownBusy} />
            <Button variant="secondary" label={importKnownBusy ? 'Đang đối soát…' : 'Đối soát'}
              accessibilityLabel="Đối soát mã lượt đã biết" onPress={onImportKnownOp}
              disabled={importKnownBusy || !knownOpInput.trim()} />
            {importKnownError ? <Text accessibilityRole="alert" style={{ ...typography.footnote, color: colors.deny }}>{importKnownError}</Text> : null}
            {importKnownInfo && !importKnownError ? <Text style={{ ...typography.footnote, color: colors.secondary }}>{importKnownInfo}</Text> : null}
          </> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  retryBtn: { alignSelf: 'flex-start' }
});

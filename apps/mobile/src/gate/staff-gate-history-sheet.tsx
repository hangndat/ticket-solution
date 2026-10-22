import { BottomSheet, Host } from '@expo/ui';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { StaffGateDeviceHistoryPanel } from './staff-gate-device-history-panel.tsx';
import type { DeviceScanHistoryRow } from './staff-gate-device-history.ts';
import { colors } from '@/theme/colors';
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function StaffGateHistorySheet({
  visible,
  rows,
  onClose
}: {
  visible: boolean;
  rows: DeviceScanHistoryRow[];
  onClose: () => void;
}) {
  return (
    <Host>
      <BottomSheet
        isPresented={visible}
        onDismiss={onClose}
        snapPoints={[{ fraction: 0.8 }]}
        containerColor={colors.background}
        testID="gate-history-sheet"
      >
        <View style={{ gap: space.sm, maxHeight: '100%' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ ...typography.bodySemibold, color: colors.label }}
            >
              Lịch sử trên máy này
            </Text>
            <Button
              variant="ghost"
              label="Đóng"
              accessibilityLabel="Đóng"
              onPress={onClose}
              hitSlop={8}
            />
          </View>
          <Text style={{ ...typography.caption, color: colors.secondary }}>
            Chỉ các lượt quét lưu trên thiết bị — không phải toàn hệ thống.
          </Text>
          <StaffGateDeviceHistoryPanel rows={rows} hideTitle />
        </View>
      </BottomSheet>
    </Host>
  );
}

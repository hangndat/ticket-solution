import { Modal, Pressable, Text, View } from 'react-native';
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end'
        }}
        onPress={onClose}
        accessibilityLabel="Đóng lịch sử quét"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: space.lg
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: space.sm
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ ...typography.bodySemibold,  color: colors.label }}
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
          <Text style={{ ...typography.caption, color: colors.secondary,  marginBottom: space.sm }}>
            Chỉ các lượt quét lưu trên thiết bị — không phải toàn hệ thống.
          </Text>
          <StaffGateDeviceHistoryPanel rows={rows} hideTitle />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

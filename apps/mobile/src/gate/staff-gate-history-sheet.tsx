import { Modal, Pressable, Text, View } from 'react-native';
import { StaffGateDeviceHistoryPanel } from './staff-gate-device-history-panel.tsx';
import type { DeviceScanHistoryRow } from './staff-gate-device-history.ts';
import { colors } from '@/theme/colors';

export function StaffGateHistorySheet({
  visible,
  rows,
  onClose,
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
          justifyContent: 'flex-end',
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
            padding: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 17, fontWeight: '600', color: colors.label }}
            >
              Lịch sử trên máy này
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              hitSlop={8}
            >
              <Text style={{ color: colors.accent, fontSize: 16 }}>Đóng</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.secondary, fontSize: 13, marginBottom: 8 }}>
            Chỉ các lượt quét lưu trên thiết bị — không phải toàn hệ thống.
          </Text>
          <StaffGateDeviceHistoryPanel rows={rows} hideTitle />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

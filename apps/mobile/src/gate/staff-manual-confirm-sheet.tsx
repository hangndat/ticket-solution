import { Modal, Pressable, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { brand } from '@/theme/tokens';

export function StaffManualConfirmSheet({
  visible,
  previewLine,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  previewLine: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(11, 18, 32, 0.53)',
          justifyContent: 'center',
          padding: 22,
        }}
        onPress={onCancel}
        accessibilityLabel="Đóng xác nhận vé"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: brand.paper,
            borderRadius: 20,
            padding: 22,
            gap: 12,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: colors.label, fontSize: 20, fontWeight: '700' }}
          >
            Vé hợp lệ
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 20 }}>
            {previewLine}
          </Text>
          <Pressable
            testID="gate-manual-confirm-admit"
            accessibilityRole="button"
            accessibilityLabel="Xác nhận vào cổng"
            disabled={busy}
            onPress={onConfirm}
            style={{
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: colors.accent,
              opacity: busy ? 0.45 : 1,
              marginTop: 4,
            }}
          >
            <Text style={{ color: colors.onAccent, fontSize: 17, fontWeight: '600' }}>
              {busy ? 'Đang xử lý…' : 'Xác nhận vào cổng'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hủy xác nhận"
            disabled={busy}
            onPress={onCancel}
            style={{
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
          >
            <Text style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>
              Hủy
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

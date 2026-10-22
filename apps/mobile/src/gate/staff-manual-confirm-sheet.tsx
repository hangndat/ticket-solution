import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { colors } from '@/theme/colors';
import { brand, space } from '@/theme/tokens';

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
          <Button
            testID="gate-manual-confirm-admit"
            label={busy ? 'Đang xử lý…' : 'Xác nhận vào cổng'}
            loading={busy}
            accessibilityLabel="Xác nhận vào cổng"
            disabled={busy}
            onPress={onConfirm}
            style={styles.confirm}
          />
          <Button
            label="Hủy"
            variant="secondary"
            accessibilityLabel="Hủy xác nhận"
            disabled={busy}
            onPress={onCancel}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  confirm: { marginTop: space.xs },
});

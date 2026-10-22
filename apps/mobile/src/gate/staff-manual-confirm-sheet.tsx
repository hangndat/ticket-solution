/**
 * Giữ RN Modal (fade, centered): hộp xác nhận có preview nhiều dòng + nút branded
 * Live Pulse; Alert.alert không đủ layout/hint và không giữ testID gate-manual-confirm-*.
 */
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { colors } from '@/theme/colors';
import { brand, radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function StaffManualConfirmSheet({
  visible,
  previewLine,
  busy,
  onConfirm,
  onCancel
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
          padding: space.xl
        }}
        onPress={onCancel}
        accessibilityLabel="Đóng xác nhận vé"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: brand.paper,
            borderRadius: radius.xl,
            padding: space.xl,
            gap: space.md
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ ...typography.sectionTitleBold, color: colors.label }}
          >
            Vé hợp lệ
          </Text>
          <Text style={{ ...typography.footnote, color: colors.secondary,  lineHeight: 20 }}>
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
  confirm: { marginTop: space.xs }
});

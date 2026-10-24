/**
 * Giữ RN Modal (fade, centered): hộp xác nhận có preview nhiều dòng + nút branded
 * Live Pulse; Alert.alert không đủ layout/hint và không giữ testID gate-manual-confirm-*.
 */
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/button';
import {
  MANUAL_PREVIEW_DISCLAIMER,
  MANUAL_PREVIEW_HEADER,
  MANUAL_SUBMIT_TO_GATE_LABEL,
} from '@/gate/staff-manual-confirm-copy';
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
            {MANUAL_PREVIEW_HEADER}
          </Text>
          <Text style={{ ...typography.footnote, color: colors.secondary,  lineHeight: 20 }}>
            {previewLine}
          </Text>
          <Text style={{ ...typography.micro, color: colors.secondary,  lineHeight: 18 }}>
            {MANUAL_PREVIEW_DISCLAIMER}
          </Text>
          <Button
            testID="gate-manual-confirm-admit"
            label={busy ? 'Đang xử lý…' : MANUAL_SUBMIT_TO_GATE_LABEL}
            loading={busy}
            accessibilityLabel={MANUAL_SUBMIT_TO_GATE_LABEL}
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

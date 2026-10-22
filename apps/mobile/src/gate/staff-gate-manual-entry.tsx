import { useEffect, useRef, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function StaffGateManualEntryModal({
  visible,
  value,
  disabled,
  onChange,
  onSubmit,
  onClose
}: {
  visible: boolean;
  value: string;
  disabled?: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<ComponentRef<typeof Input>>(null);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Đóng nhập mã thủ công"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
            <Text
              accessibilityRole="header"
              style={styles.sheetTitle}
            >
              Nhập mã vé
            </Text>
            <Text style={styles.sheetHint}>
              Dán UUID vé hoặc JSON từ QR. Bấm Gửi để kiểm tra — không tự gửi
              khi đóng.
            </Text>
            <Input
              ref={inputRef}
              testID="gate-scan-input"
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Nhập mã vé hoặc JSON QR"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              editable={!disabled}
              keyboardType="ascii-capable"
              returnKeyType="send"
              onSubmitEditing={() => {
                if (!disabled && value.trim()) onSubmit();
              }}
              multiline
              style={styles.multilineField}
            />
            <View style={styles.actions}>
              <Button
                label="Hủy"
                variant="secondary"
                accessibilityLabel="Hủy nhập mã"
                onPress={onClose}
                style={styles.actionBtn}
              />
              <Button
                testID="gate-manual-submit"
                label="Gửi"
                accessibilityLabel="Gửi mã vé để quét"
                disabled={disabled || value.trim().length === 0}
                onPress={onSubmit}
                style={styles.actionBtn}
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg - 2,
    borderTopRightRadius: radius.lg - 2,
    padding: space.lg,
    gap: space.md
  },
  sheetTitle: { ...typography.bodySemibold, color: colors.label, },
  sheetHint: { ...typography.footnote, color: colors.secondary },
  multilineField: { minHeight: 88 },
  actions: { flexDirection: 'row', gap: space.md },
  actionBtn: { flex: 1 }
});

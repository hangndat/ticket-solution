import { useEffect, useRef, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';

export function StaffGateManualEntryModal({
  visible,
  value,
  disabled,
  onChange,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  value: string;
  disabled?: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

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
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
        accessibilityLabel="Đóng nhập mã thủ công"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              gap: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.label,
                fontSize: 17,
                fontWeight: '600',
              }}
            >
              Nhập mã vé
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 14 }}>
              Dán UUID vé hoặc JSON từ QR. Bấm Gửi để kiểm tra — không tự gửi
              khi đóng.
            </Text>
            <TextInput
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
              style={{
                minHeight: 88,
                borderRadius: 10,
                padding: 12,
                backgroundColor: colors.card,
                color: colors.label,
                fontSize: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hủy nhập mã"
                onPress={onClose}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.label, fontSize: 16 }}>Hủy</Text>
              </Pressable>
              <Pressable
                testID="gate-manual-submit"
                accessibilityRole="button"
                accessibilityLabel="Gửi mã vé để quét"
                disabled={disabled || value.trim().length === 0}
                onPress={onSubmit}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: colors.accent,
                  opacity: disabled || value.trim().length === 0 ? 0.45 : 1,
                }}
              >
                <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '600' }}>
                  Gửi
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

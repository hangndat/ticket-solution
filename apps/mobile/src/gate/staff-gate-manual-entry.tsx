import { useEffect, useRef, type ComponentRef } from 'react';
import { BottomSheet, Host } from '@expo/ui';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/theme/colors';
import { space } from '@/theme/tokens';
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
    <Host>
      <BottomSheet
        isPresented={visible}
        onDismiss={onClose}
        snapPoints={['half', 'full']}
        containerColor={colors.background}
        testID="gate-manual-entry-sheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              Nhập mã vé
            </Text>
            <Text style={styles.sheetHint}>
              Nhập mã trên vé để xác minh trực tuyến. Mã không được xác minh
              khi mất mạng.
            </Text>
            <Input
              ref={inputRef}
              testID="gate-scan-input"
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Nhập mã thủ công trên vé"
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
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.md },
  sheetTitle: { ...typography.bodySemibold, color: colors.label },
  sheetHint: { ...typography.footnote, color: colors.secondary },
  multilineField: { minHeight: 88 },
  actions: { flexDirection: 'row', gap: space.md },
  actionBtn: { flex: 1 }
});

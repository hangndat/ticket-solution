import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import { normalizeGatePasteInput } from '@/gate/gate-scan';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { colors } from '@/theme/colors';
import { brand } from '@/theme/tokens';

export function StaffManualEntryScreen() {
  const gate = useStaffGateWorkspace();
  const [raw, setRaw] = useState('');

  const onSubmit = useCallback(() => {
    const code = raw.trim();
    if (!code || gate.scanDisabled) return;
    void gate.submitScan(code);
    setRaw('');
  }, [gate, raw]);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      >
        <StaffGateNoEventState />
        <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 20 }}>
          Dán hoặc gõ UUID / JSON từ QR. Cùng phiên và sự kiện với tab Scan — không
          tự gửi khi chuyển tab.
        </Text>
        <TextInput
          testID="gate-scan-input"
          value={raw}
          onChangeText={(text) => setRaw(normalizeGatePasteInput(text))}
          accessibilityLabel="Nhập mã vé hoặc JSON QR"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          editable={!gate.scanDisabled}
          keyboardType="ascii-capable"
          returnKeyType="send"
          onSubmitEditing={onSubmit}
          multiline
          style={{
            minHeight: 120,
            borderRadius: 12,
            padding: 14,
            backgroundColor: colors.card,
            color: colors.label,
            fontSize: 16,
            textAlignVertical: 'top',
          }}
        />
        <Pressable
          testID="gate-manual-submit"
          accessibilityRole="button"
          accessibilityLabel="Xử lý mã vé"
          disabled={gate.scanDisabled || raw.trim().length === 0}
          onPress={onSubmit}
          style={{
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: colors.accent,
            opacity: gate.scanDisabled || raw.trim().length === 0 ? 0.45 : 1,
          }}
        >
          <Text
            style={{ color: colors.onAccent, fontSize: 17, fontWeight: '600' }}
          >
            Xử lý mã
          </Text>
        </Pressable>
        {gate.gateEventsError && !gate.gateScope ? (
          <Text style={{ color: colors.deny, fontSize: 14 }}>
            {gate.gateEventsError}
          </Text>
        ) : null}
      </ScrollView>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.manual} largeTitle />
    </>
  );
}

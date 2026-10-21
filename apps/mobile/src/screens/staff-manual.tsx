import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { normalizeGatePasteInput } from '@/gate/gate-scan';
import { checkManualEntryCode } from '@/gate/staff-manual-entry-flow';
import { StaffManualConfirmSheet } from '@/gate/staff-manual-confirm-sheet';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { colors } from '@/theme/colors';
import { brand } from '@/theme/tokens';

export function StaffManualEntryScreen() {
  const gate = useStaffGateWorkspace();
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [previewLine, setPreviewLine] = useState('');

  const onCheck = useCallback(() => {
    const result = checkManualEntryCode(raw, gate.gateScope);
    if (!result.ok) {
      setParseError(result.message);
      setConfirmVisible(false);
      setPendingCode('');
      return;
    }
    setParseError(null);
    setPendingCode(raw.trim());
    setPreviewLine(result.previewLine);
    setConfirmVisible(true);
  }, [gate.gateScope, raw]);

  const onConfirmAdmit = useCallback(() => {
    const code = pendingCode.trim();
    if (!code || gate.scanDisabled) return;
    void gate.submitScan(code).then(() => {
      setRaw('');
      setPendingCode('');
      setConfirmVisible(false);
      setParseError(null);
    });
  }, [gate, pendingCode]);

  const onCancelConfirm = useCallback(() => {
    if (gate.busy) return;
    setConfirmVisible(false);
    setPendingCode('');
  }, [gate.busy]);

  const submitDisabled =
    gate.scanDisabled || raw.trim().length === 0 || gate.busy;

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
          Dùng khi không thể đọc mã QR trên vé.
        </Text>
        <View style={{ gap: 8 }}>
          <Text
            nativeID="staff-manual-ticket-label"
            style={{ color: colors.label, fontSize: 14, fontWeight: '600' }}
          >
            Mã vé
          </Text>
          <TextInput
            testID="gate-scan-input"
            value={raw}
            onChangeText={(text) => {
              setRaw(normalizeGatePasteInput(text));
              if (parseError) setParseError(null);
            }}
            accessibilityLabel="Nhập mã trên vé"
            placeholder="Nhập mã trên vé"
            placeholderTextColor={colors.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            editable={!gate.scanDisabled && !gate.busy}
            keyboardType="ascii-capable"
            returnKeyType="done"
            onSubmitEditing={onCheck}
            multiline={false}
            style={{
              minHeight: 48,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: colors.card,
              color: colors.label,
              fontSize: 16,
            }}
          />
        </View>
        <Pressable
          testID="gate-manual-submit"
          accessibilityRole="button"
          accessibilityLabel="Kiểm tra vé"
          disabled={submitDisabled}
          onPress={onCheck}
          style={{
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: colors.accent,
            opacity: submitDisabled ? 0.45 : 1,
          }}
        >
          <Text
            style={{ color: colors.onAccent, fontSize: 17, fontWeight: '600' }}
          >
            Kiểm tra vé
          </Text>
        </Pressable>
        <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>
          Kiểm tra thông tin trước khi xác nhận lượt vào.
        </Text>
        {parseError ? (
          <Text style={{ color: colors.deny, fontSize: 14 }}>{parseError}</Text>
        ) : null}
        {gate.gateEventsError && !gate.gateScope ? (
          <Text style={{ color: colors.deny, fontSize: 14 }}>
            {gate.gateEventsError}
          </Text>
        ) : null}
      </ScrollView>
      <StaffManualConfirmSheet
        visible={confirmVisible}
        previewLine={previewLine}
        busy={gate.busy}
        onConfirm={onConfirmAdmit}
        onCancel={onCancelConfirm}
      />
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.manual} largeTitle />
    </>
  );
}

import { useCallback, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        <Input
          testID="gate-scan-input"
          label="Mã vé"
          value={raw}
          onChangeText={(text) => {
            setRaw(normalizeGatePasteInput(text));
            if (parseError) setParseError(null);
          }}
          accessibilityLabel="Nhập mã trên vé"
          placeholder="Nhập mã trên vé"
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
        />
        <Button
          testID="gate-manual-submit"
          label="Kiểm tra vé"
          accessibilityLabel="Kiểm tra vé"
          disabled={submitDisabled}
          onPress={onCheck}
          size="lg"
        />
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

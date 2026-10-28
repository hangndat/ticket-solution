import { useCallback, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gateOutcomeAnnouncement } from '@/a11y/announcements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { canReconcile, normalizeGatePasteInput } from '@/gate/gate-scan';
import { announcementPhaseFor } from '@/gate/gate-outcome-copy';
import { checkManualEntryCode } from '@/gate/staff-manual-entry-flow';
import { StaffManualConfirmSheet } from '@/gate/staff-manual-confirm-sheet';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateOpsSticky } from '@/gate/staff-gate-ops-sticky';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import type { GateScanStatusView } from '@/gate/gate-scan-status-ui';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { colors } from '@/theme/colors';
import { brand, radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

function manualResultToneColor(tone: GateScanStatusView['tone']): string {
  if (tone === 'admit') return colors.admit;
  if (tone === 'deny') return colors.deny;
  if (tone === 'unknown') return colors.unknown;
  if (tone === 'default') return colors.label;
  return colors.label;
}

export function StaffManualEntryScreen() {
  const insets = useSafeAreaInsets();
  const gate = useStaffGateWorkspace();
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [previewLine, setPreviewLine] = useState('');
  const [clearedFreshAdmitId, setClearedFreshAdmitId] = useState<string | null>(
    null,
  );

  const resultView = gate.persistentScanStatus;

  const showScanResult = Boolean(
    gate.busy || gate.toastOp || gate.pendingOp,
  );
  const announceOp = gate.busy
    ? null
    : gate.pendingOp ?? gate.toastOp;

  const activeOp = gate.toastOp ?? gate.pendingOp;
  const freshAdmitKey =
    activeOp?.phase === 'admitted' && activeOp.admissionKind === 'fresh'
      ? activeOp.id
      : null;
  if (freshAdmitKey && freshAdmitKey !== clearedFreshAdmitId) {
    setClearedFreshAdmitId(freshAdmitKey);
    setRaw('');
    setPendingCode('');
    setParseError(null);
  }

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
    setConfirmVisible(false);
    void gate.submitScan(code);
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
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: Math.max(insets.bottom, 20) + space.huge,
          gap: space.lg,
        }}
      >
        <StaffGateOpsSticky
          connectivity={gate.connectivity}
          hasSession={Boolean(gate.sessionId)}
          gateName={gate.gates.sessionGateName}
          queueSnap={gate.queueSnap}
          onSync={() => void gate.syncNow()}
          machineLabel={gate.machineLabel}
          eventName={gate.gateScope?.name ?? null}
          gateScope={gate.gateScope}
          pendingOp={gate.pendingOp}
          onContinueScan={
            gate.pendingOp && !gate.busy ? gate.dismissPendingAction : undefined
          }
          onReconcile={() => void gate.reconcile()}
          reconcileEnabled={Boolean(
            gate.pendingOp && canReconcile(gate.pendingOp) && !gate.busy,
          )}
        />
        <StaffGateNoEventState />
        <Text
          style={{ ...typography.footnote, color: colors.secondary, lineHeight: 20 }}
        >
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
        <Text
          style={{ ...typography.micro, color: colors.secondary, lineHeight: 18 }}
        >
          Kiểm tra định dạng mã trước khi gửi lên máy chủ — kết quả cổng hiện bên
          dưới.
        </Text>
        {parseError ? (
          <Text style={{ ...typography.footnote, color: colors.deny }}>
            {parseError}
          </Text>
        ) : null}
        {gate.gateEventsError && !gate.gateScope ? (
          <Text style={{ ...typography.footnote, color: colors.deny }}>
            {gate.gateEventsError}
          </Text>
        ) : null}
        {showScanResult ? (
          <View
            testID="gate-manual-scan-result"
            {...gateOutcomeAnnouncement({
              phase: announcementPhaseFor(
                gate.busy ? 'confirming' : announceOp?.phase,
              ),
              title: gate.busy ? 'Đang kiểm tra cổng' : resultView.label,
              message: gate.busy
                ? 'Đang gửi mã lên máy chủ.'
                : resultView.hint,
            })}
            accessibilityLiveRegion={
              resultView.assertive ? 'assertive' : 'polite'
            }
            style={{
              padding: space.lg,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
              gap: space.sm,
            }}
          >
            <Text
              style={{
                ...typography.callout,
                color: manualResultToneColor(resultView.tone),
              }}
            >
              {gate.busy ? 'Đang kiểm tra cổng…' : resultView.label}
            </Text>
            <Text
              style={{
                ...typography.footnote,
                color: colors.secondary,
                lineHeight: 20,
              }}
            >
              {gate.busy
                ? 'Đang gửi mã lên máy chủ.'
                : resultView.hint}
            </Text>
          </View>
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

import { useCallback, useState } from 'react';
import { Keyboard, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gateOutcomeAnnouncement } from '@/a11y/announcements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { canReconcile, normalizeGatePasteInput } from '@/gate/gate-scan';
import { announcementPhaseFor } from '@/gate/gate-outcome-copy';
import { canSubmitManualConfirmation, checkManualEntryCode, manualResultAction } from '@/gate/staff-manual-entry-flow';
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
  if (tone === 'warning') return colors.warning;
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

  const resultView = gate.persistentScanStatus;

  const showScanResult = Boolean(
    gate.busy || gate.toastOp || gate.pendingOp,
  );
  const announceOp = gate.busy
    ? null
    : gate.pendingOp ?? gate.toastOp;

  const activeOp = gate.pendingOp ?? gate.toastOp;
  const displayRaw = activeOp?.phase === 'admitted' && activeOp.admissionKind === 'fresh'
    ? '' : raw;
  const resultAction = showScanResult && !gate.busy
    ? manualResultAction(resultView.kind, Boolean(activeOp && canReconcile(activeOp)))
    : null;
  const safeResultHint = gate.busy
    ? 'Đang gửi mã lên máy chủ. Chưa cho vào.'
    : resultView.kind === 'denied'
      ? 'Máy chủ từ chối lượt này. Không cho vào; kiểm tra mã hoặc liên hệ quản lý cổng.'
      : resultView.kind === 'unknown'
        ? 'Chưa có xác nhận. Không cho vào; đối soát lượt này trước khi xử lý tiếp.'
        : resultView.kind === 'recorded'
          ? 'Đã có bản ghi trên máy chủ; đây không phải lượt vào mới.'
          : resultView.kind === 'queued'
            ? 'Chưa xác minh trên máy chủ. Không cho vào.'
            : resultView.hint;

  const onCheck = useCallback(() => {
    const result = checkManualEntryCode(displayRaw, gate.gateScope);
    if (!result.ok) {
      setParseError(result.message);
      setConfirmVisible(false);
      setPendingCode('');
      return;
    }
    setParseError(null);
    setPendingCode(result.code);
    setPreviewLine(result.previewLine);
    setConfirmVisible(true);
  }, [displayRaw, gate.gateScope]);

  const onConfirmAdmit = useCallback(() => {
    const code = pendingCode.trim();
    if (!canSubmitManualConfirmation(code, gate.scanDisabled, gate.connectivity)) return;
    setConfirmVisible(false);
    setPendingCode('');
    setParseError(null);
    Keyboard.dismiss();
    void gate.submitScan(code, 'manual');
  }, [gate, pendingCode]);

  const onNextCode = useCallback(() => {
    gate.dismissPendingAction();
    setRaw('');
    setPendingCode('');
    setParseError(null);
  }, [gate]);

  const onCancelConfirm = useCallback(() => {
    if (gate.busy) return;
    setConfirmVisible(false);
    setPendingCode('');
  }, [gate.busy]);

  const submitDisabled =
    gate.scanDisabled || displayRaw.trim().length === 0 || gate.busy;

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
          Dùng mã nhập tay trên vé khi QR không đọc được.
        </Text>
        <Input
          testID="gate-scan-input"
          label="Mã trên vé"
          value={displayRaw}
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
          label="Tiếp tục"
          accessibilityLabel="Kiểm tra định dạng mã"
          disabled={submitDisabled}
          onPress={onCheck}
          size="lg"
        />
        <Text
          style={{ ...typography.micro, color: colors.secondary, lineHeight: 18 }}
        >
          Bước này chỉ kiểm tra định dạng. Mã chưa được gửi lên máy chủ.
        </Text>
        <Text style={{ ...typography.micro, color: colors.unknown, lineHeight: 18 }}>
          Cần kết nối mạng để xác minh mã. Không thể cho khách qua khi offline.
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
                : safeResultHint,
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
              {safeResultHint}
            </Text>
            {resultAction === 'reconcile' ? (
              <Button
                label="Đối soát"
                accessibilityLabel="Đối soát kết quả lượt này"
                onPress={() => void gate.reconcile()}
                variant="secondary"
              />
            ) : null}
            {resultAction === 'next' || resultAction === 'other' ? (
              <Button
                label={resultAction === 'next' ? 'Nhập mã tiếp' : 'Kiểm tra mã khác'}
                accessibilityLabel={resultAction === 'next' ? 'Nhập mã tiếp' : 'Kiểm tra mã khác'}
                onPress={onNextCode}
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <StaffManualConfirmSheet
        visible={confirmVisible}
        previewLine={previewLine}
        busy={gate.busy}
        offline={gate.connectivity === 'offline'}
        onConfirm={onConfirmAdmit}
        onCancel={onCancelConfirm}
      />
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.manual} largeTitle />
    </>
  );
}

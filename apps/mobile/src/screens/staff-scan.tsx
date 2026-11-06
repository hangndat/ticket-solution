import { ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gateOutcomeAnnouncement } from '@/a11y/announcements';
import { AtmosphereWash } from '@/components/screen-atmosphere';
import { scanCopy } from '@/components/screen-state-copy';
import { canReconcile } from '@/gate/gate-scan';
import { GateCamera } from '@/gate/gate-camera';
import { GateCameraIdle, StaffGateOpenSession } from '@/gate/staff-gate-open-session';
import { announcementPhaseFor } from '@/gate/gate-outcome-copy';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateOpsSticky } from '@/gate/staff-gate-ops-sticky';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { StaffGateScanStatusPanel } from '@/gate/staff-gate-scan-status';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { colors } from '@/theme/colors';
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function StaffScanScreen() {
  const insets = useSafeAreaInsets();
  const gate = useStaffGateWorkspace();

  const announceOp = gate.busy ? null : gate.pendingOp ?? gate.toastOp;
  const outcomeView = gate.persistentScanStatus;
  const a11yTitle = gate.busy ? scanCopy.checking.title : outcomeView.label;
  const a11yDetail = gate.busy ? scanCopy.checking.body : outcomeView.hint;
  const showOutcome = gate.busy || outcomeView.kind !== 'idle' || gate.pendingOp !== null;
  const outcomeEmphasized = showOutcome;

  // Live preview only with an open session (or while the gate list failed to
  // load, so the first-scan open fallback never regresses).
  const showLive = Boolean(gate.sessionId) || gate.gates.openUi.scanFallback;

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paper
        }}
      >
        <AtmosphereWash />
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.sm,
            zIndex: 2,
            backgroundColor: colors.paper
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
            reconcileEnabled={false}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            padding: space.xl,
            paddingBottom: Math.max(insets.bottom, 20) + 28,
            gap: space.lg
          }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
        >
          <StaffGateNoEventState />
          <View style={{ position: 'relative' }}>
            {showLive ? (
              <GateCamera
                disabled={gate.scanDisabled || gate.toastVisible}
                onScan={gate.handleCameraScan}
              />
            ) : (
              <GateCameraIdle />
            )}
            {showOutcome ? (
              <View
                testID="gate-scan-outcome-panel"
                {...gateOutcomeAnnouncement({
                  phase: announcementPhaseFor(
                    gate.busy ? 'confirming' : announceOp?.phase,
                  ),
                  title: a11yTitle,
                  message: a11yDetail
                })}
                accessibilityLiveRegion={outcomeView.assertive ? 'assertive' : 'polite'}
                style={{ position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm }}
              >
                <StaffGateScanStatusPanel
                  view={outcomeView}
                  busy={gate.busy}
                  emphasized={outcomeEmphasized}
                />
              </View>
            ) : null}
          </View>
          <StaffGateOpenSession gates={gate.gates} />
          {gate.pendingOp && !gate.busy ? (
            <View style={{ gap: space.sm }}>
              {canReconcile(gate.pendingOp) ? (
                <Button
                  variant="secondary"
                  label="Đối soát"
                  accessibilityLabel="Đối soát kết quả chưa rõ"
                  onPress={() => void gate.reconcile()}
                />
              ) : null}
              <Button
                testID="gate-scan-continue"
                label="Quét tiếp"
                accessibilityLabel="Quét tiếp"
                onPress={gate.dismissPendingAction}
              />
            </View>
          ) : showLive && !showOutcome ? (
            <Text
              style={{ ...typography.footnote, color: colors.secondary }}
            >
              Đưa QR vào khung hoặc nhập mã thủ công ở tab Nhập tay.
            </Text>
          ) : null}
        </ScrollView>
      </View>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.scan} largeTitle={false} />
    </>
  );
}

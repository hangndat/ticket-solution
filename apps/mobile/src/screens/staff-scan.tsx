import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gateOutcomeAnnouncement } from '@/a11y/announcements';
import { AtmosphereWash } from '@/components/screen-atmosphere';
import { scanCopy } from '@/components/screen-state-copy';
import { scanDecisionActions } from '@/gate/gate-scan-decision-actions';
import { scanDecisionCopy } from '@/gate/gate-scan-decision-copy';
import { GateCamera } from '@/gate/gate-camera';
import {
  GateCameraIdle,
  StaffGateOpenSession,
} from '@/gate/staff-gate-open-session';
import { announcementPhaseFor } from '@/gate/gate-outcome-copy';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateOpsSticky } from '@/gate/staff-gate-ops-sticky';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { StaffGateScanStatusPanel } from '@/gate/staff-gate-scan-status';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function StaffScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const gate = useStaffGateWorkspace();

  const announceOp = gate.busy ? null : (gate.pendingOp ?? gate.toastOp);
  const outcomeView = gate.persistentScanStatus;
  const a11yTitle = gate.busy ? scanCopy.checking.title : outcomeView.label;
  const a11yDetail = gate.busy ? scanCopy.checking.body : outcomeView.hint;
  const showOutcome =
    gate.busy || outcomeView.kind !== 'idle' || gate.pendingOp !== null;
  const outcomeEmphasized = showOutcome;

  // Live preview only with an open session (or while the gate list failed to
  // load, so the first-scan open fallback never regresses).
  const showLive = Boolean(gate.sessionId) || gate.gates.openUi.scanFallback;
  const actions = scanDecisionActions({
    op: gate.pendingOp,
    queue: gate.queueSnap,
    connectivity: gate.connectivity,
    busy: gate.busy,
  });
  const decisionCopy = scanDecisionCopy(outcomeView.kind);

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paper,
        }}
      >
        <AtmosphereWash />
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.sm,
            zIndex: 2,
            backgroundColor: colors.paper,
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
            gap: space.lg,
          }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
        >
          <StaffGateNoEventState />
          <Text
            accessibilityRole="header"
            style={{ ...typography.sectionTitleBold, color: colors.label }}
          >
            Quét vé
          </Text>
          <View
            testID="gate-camera-decision-region"
            style={{ position: 'relative', minHeight: 300, gap: space.md }}
          >
            {showOutcome ? (
              <View
                style={{
                  minHeight: 300,
                  padding: space.md,
                  justifyContent: 'flex-end',
                  backgroundColor: colors.ink,
                  borderRadius: radius.lg,
                }}
              >
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    position: 'absolute',
                    top: space.xl,
                    left: space.xl,
                    right: space.xl,
                    bottom: space.xl,
                    justifyContent: 'space-between',
                    opacity: 0.75,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderTopWidth: 3,
                        borderLeftWidth: 3,
                        borderColor: colors.paper,
                        borderTopLeftRadius: radius.sm,
                      }}
                    />
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderTopWidth: 3,
                        borderRightWidth: 3,
                        borderColor: colors.paper,
                        borderTopRightRadius: radius.sm,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderBottomWidth: 3,
                        borderLeftWidth: 3,
                        borderColor: colors.paper,
                        borderBottomLeftRadius: radius.sm,
                      }}
                    />
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderBottomWidth: 3,
                        borderRightWidth: 3,
                        borderColor: colors.paper,
                        borderBottomRightRadius: radius.sm,
                      }}
                    />
                  </View>
                </View>
                <View
                  testID="gate-scan-outcome-panel"
                  style={{ gap: space.sm, zIndex: 1 }}
                  {...gateOutcomeAnnouncement({
                    phase: announcementPhaseFor(
                      gate.busy ? 'confirming' : announceOp?.phase,
                    ),
                    title: a11yTitle,
                    message: a11yDetail,
                  })}
                  accessibilityLiveRegion={
                    outcomeView.assertive ? 'assertive' : 'polite'
                  }
                >
                  <StaffGateScanStatusPanel
                    view={outcomeView}
                    busy={gate.busy}
                    emphasized={outcomeEmphasized}
                    eyebrow={decisionCopy.eyebrow}
                  />
                </View>
              </View>
            ) : showLive ? (
              <GateCamera
                disabled={gate.scanDisabled || gate.toastVisible}
                onScan={gate.handleCameraScan}
              />
            ) : (
              <GateCameraIdle />
            )}
            {showOutcome ? (
              <View style={{ gap: space.sm }}>
                {actions.reconcile ? (
                  <Button
                    variant="secondary"
                    label="Đối soát"
                    accessibilityLabel="Đối soát kết quả chưa rõ"
                    onPress={() => void gate.reconcile()}
                  />
                ) : null}
                {actions.sync ? (
                  <Button
                    variant="secondary"
                    testID="gate-scan-sync-now"
                    label="Đồng bộ ngay"
                    accessibilityLabel="Đồng bộ lượt quét đang chờ"
                    onPress={() => void gate.syncNow()}
                  />
                ) : null}
                {actions.continueScan ? (
                  <Button
                    variant="secondary"
                    testID="gate-scan-continue"
                    label="Quét tiếp"
                    accessibilityLabel="Quét tiếp"
                    onPress={gate.dismissPendingAction}
                  />
                ) : null}
              </View>
            ) : null}
            {showOutcome && decisionCopy.guidance ? (
              <Text style={{ ...typography.footnote, color: colors.secondary }}>
                {decisionCopy.guidance}
              </Text>
            ) : null}
            {showLive && !showOutcome ? (
              <View style={{ gap: space.sm }}>
                <Text
                  style={{ ...typography.footnote, color: colors.secondary }}
                >
                  Sau khi nhận mã, app kiểm tra với hệ thống. Chưa cho khách vào
                  trong lúc chờ phản hồi.
                </Text>
                <Button
                  variant="secondary"
                  testID="gate-scan-manual-entry"
                  label="Không quét được? Mở tab Nhập tay"
                  accessibilityLabel="Không quét được? Mở tab Nhập tay"
                  onPress={() => router.push('/staff-manual')}
                />
              </View>
            ) : null}
          </View>
          <StaffGateOpenSession gates={gate.gates} />
        </ScrollView>
      </View>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.scan} />
    </>
  );
}

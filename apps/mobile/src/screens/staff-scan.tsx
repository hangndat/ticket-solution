import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gateOutcomeAnnouncement } from '@/a11y/announcements';
import { AtmosphereWash } from '@/components/screen-atmosphere';
import { scanCopy } from '@/components/screen-state-copy';
import { canReconcile } from '@/gate/gate-scan';
import { GateCamera } from '@/gate/gate-camera';
import { announcementPhaseFor } from '@/gate/gate-outcome-copy';
import { StaffGateNoEventState } from '@/gate/staff-gate-empty-state';
import { StaffGateOpsSticky } from '@/gate/staff-gate-ops-sticky';
import { StaffGateScreenChrome } from '@/gate/staff-gate-screen-chrome';
import { shouldShowCameraToast } from '@/gate/staff-gate-scan-feedback';
import { StaffGateScanStatusPanel } from '@/gate/staff-gate-scan-status';
import { StaffGateScanToast } from '@/gate/staff-gate-scan-toast';
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
  const showCameraToast =
    gate.toastVisible &&
    shouldShowCameraToast(gate.toastOp, gate.busy);
  const outcomeEmphasized =
    gate.busy || outcomeView.kind !== 'idle' || gate.pendingOp !== null;

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
            sessionId={gate.sessionId}
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
            <GateCamera
              disabled={gate.scanDisabled}
              onScan={gate.handleCameraScan}
            />
            <StaffGateScanToast
              active={Boolean(showCameraToast && (gate.toastOp || gate.busy))}
              visible={showCameraToast}
              view={gate.toastStatus}
              busy={gate.busy}
            />
          </View>
          <View
            testID="gate-scan-outcome-panel"
            {...gateOutcomeAnnouncement({
              phase: announcementPhaseFor(
                gate.busy ? 'confirming' : announceOp?.phase,
              ),
              title: a11yTitle,
              message: a11yDetail
            })}
            accessibilityLiveRegion={
              outcomeView.assertive ? 'assertive' : 'polite'
            }
          >
            <StaffGateScanStatusPanel
              view={outcomeView}
              busy={gate.busy}
              emphasized={outcomeEmphasized}
            />
          </View>
          <Text
            style={{ ...typography.footnote, color: colors.secondary, }}
          >
            Quét QR trong khung — kết quả hiện bên dưới, không che camera. Nhập tay
            và lịch sử ở tab riêng.
          </Text>
        </ScrollView>
      </View>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.scan} largeTitle={false} />
    </>
  );
}

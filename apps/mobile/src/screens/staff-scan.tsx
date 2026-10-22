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
import { StaffGateScanToast } from '@/gate/staff-gate-scan-toast';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import { colors } from '@/theme/colors';

export function StaffScanScreen() {
  const insets = useSafeAreaInsets();
  const gate = useStaffGateWorkspace();

  const announceOp = gate.busy ? null : gate.toastOp ?? gate.pendingOp;
  const a11yTitle = gate.busy ? scanCopy.checking.title : gate.toastStatus.label;
  const a11yDetail = gate.busy ? scanCopy.checking.body : gate.toastStatus.hint;

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
            paddingHorizontal: 20,
            paddingTop: 8,
            zIndex: 2,
            backgroundColor: colors.paper,
          }}
        >
          <StaffGateOpsSticky
            connectivity={gate.connectivity}
            hasSession={Boolean(gate.sessionId)}
            queueAttention={gate.queueAttention}
            syncing={gate.queueSnap.syncing}
            onSync={() => void gate.syncNow()}
            machineLabel={gate.machineLabel}
            eventName={gate.gateScope?.name ?? null}
            canSwitchEvent={gate.gateEventChoices.length > 1}
            eventPickerOpen={gate.eventPickerOpen}
            onToggleEventPicker={() => gate.setEventPickerOpen((open) => !open)}
            gateEventChoices={gate.gateEventChoices}
            gateScope={gate.gateScope}
            onSelectGateScope={gate.selectGateScope}
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
            padding: 20,
            paddingBottom: Math.max(insets.bottom, 20) + 28,
            gap: 16,
          }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
        >
          <StaffGateNoEventState />
          <View
            {...gateOutcomeAnnouncement({
              phase: announcementPhaseFor(
                gate.busy ? 'confirming' : announceOp?.phase,
              ),
              title: a11yTitle,
              message: a11yDetail,
            })}
            accessibilityLiveRegion={
              gate.toastStatus.assertive ? 'assertive' : 'polite'
            }
            style={{ position: 'relative' }}
          >
            <GateCamera
              disabled={gate.scanDisabled}
              onScan={gate.handleCameraScan}
            />
            <StaffGateScanToast
              active={Boolean(gate.toastOp || gate.busy)}
              visible={gate.toastVisible || gate.busy}
              view={gate.toastStatus}
              busy={gate.busy}
            />
          </View>
          <Text
            style={{
              textAlign: 'center',
              color: colors.secondary,
              fontSize: 14,
            }}
          >
            Quét QR trong khung — kết quả hiện giữa màn hình, rồi tự ẩn. Nhập tay và
            lịch sử ở tab riêng.
          </Text>
        </ScrollView>
      </View>
      <StaffGateScreenChrome tabTitle={STAFF_TAB_TITLES.scan} largeTitle={false} />
    </>
  );
}

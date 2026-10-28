import { presentGateScanStatus } from './gate-scan-status-ui.ts';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import type { StaffGateWorkspaceValue } from './staff-gate-workspace-context.tsx';

/** Used by the provider render and by every callback handed to a screen. */
export function projectStaffGateOwnedSnapshot(
  value: StaffGateWorkspaceValue,
  owner: SessionEpoch | null,
  current: SessionEpoch | null,
  isOwnerCurrent: () => boolean,
): StaffGateWorkspaceValue {
  const matches = !!owner && !!current &&
    owner.userId === current.userId &&
    owner.generation === current.generation &&
    isOwnerCurrent();
  const live = () => matches && isOwnerCurrent();
  const staleImport = async () => ({
    kind: 'error' as const,
    code: 'stale' as const,
    message: 'Phiên hoặc sự kiện đã đổi trong lúc đối soát — thử lại.',
  });

  const handlers = {
    setEventPickerOpen: (open: Parameters<StaffGateWorkspaceValue['setEventPickerOpen']>[0]) => {
      if (live()) value.setEventPickerOpen(open);
    },
    selectGateScope: (scope: Parameters<StaffGateWorkspaceValue['selectGateScope']>[0]) => {
      if (live()) value.selectGateScope(scope);
    },
    submitScan: (payload: string) => live() ? value.submitScan(payload) : Promise.resolve(),
    handleCameraScan: (data: string) => { if (live()) value.handleCameraScan(data); },
    reconcile: () => live() ? value.reconcile() : Promise.resolve(),
    syncNow: () => live() ? value.syncNow() : Promise.resolve(),
    focusSync: () => live() ? value.focusSync() : Promise.resolve(),
    importKnownOperation: (raw: string) => live() ? value.importKnownOperation(raw) : staleImport(),
    dismissPendingAction: () => { if (live()) value.dismissPendingAction(); },
    refreshGateEvents: async () => {
      if (live()) return value.refreshGateEvents();
      if (current && value.workspaceLoadError) {
        const [{ session }, { verifyViaMe }] = await Promise.all([
          import('../identity/session.ts'), import('../identity/fetch-me.ts'),
        ]);
        await session.restore(verifyViaMe);
      }
    },
    gates: {
      ...value.gates,
      selectGate: (gateId: string) => { if (live()) value.gates.selectGate(gateId); },
      openSession: () => live() ? value.gates.openSession() : Promise.resolve(),
      reloadGates: () => live() ? value.gates.reloadGates() : Promise.resolve(),
    },
    logoutStaff: () => live() ? value.logoutStaff() : Promise.resolve(),
  };
  if (matches) return { ...value, ...handlers };

  const idleStatus = presentGateScanStatus({ busy: false, op: null, canReconcile: false });
  return {
    ...value,
    ...handlers,
    gates: {
      ...handlers.gates,
      status: 'loading' as const,
      gates: [],
      selectedGateId: null,
      sessionGateName: null,
      openUi: { explicitOpen: false, showPicker: false, scanFallback: false, canOpen: false },
      opening: false,
      openError: null,
    },
    ready: false,
    busy: false,
    ops: [],
    sessionId: null,
    toastOp: null,
    toastVisible: false,
    pendingOp: null,
    connectivity: 'unknown',
    gateScope: null,
    gateEventChoices: [],
    gateEventsLoading: false,
    gateEventsError: current && value.workspaceLoadError ? value.gateEventsError : null,
    eventPickerOpen: false,
    queueSnap: { items: [], pendingCount: 0, conflictCount: 0, syncing: false, lastSyncError: null },
    machineLabel: '',
    deviceHistory: [],
    scanDisabled: true,
    queueAttention: false,
    toastStatus: idleStatus,
    persistentScanStatus: idleStatus,
  };
}

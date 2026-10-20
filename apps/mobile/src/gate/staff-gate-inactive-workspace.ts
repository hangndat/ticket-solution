import type { StaffGateWorkspaceValue } from './staff-gate-workspace-context.ts';
import { presentGateScanStatus } from './gate-scan-status-ui.ts';
import { EMPTY_OFFLINE_QUEUE_SNAPSHOT } from './offline-queue.ts';

const noop = () => {};
const noopAsync = async () => {};

/** Safe no-op context while staff workspace inactive (preloaded tabs during logout). */
export const INACTIVE_STAFF_GATE_WORKSPACE: StaffGateWorkspaceValue = {
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
  gateEventsError: null,
  eventPickerOpen: false,
  setEventPickerOpen: noop,
  queueSnap: EMPTY_OFFLINE_QUEUE_SNAPSHOT,
  machineLabel: '',
  deviceHistory: [],
  scanDisabled: true,
  queueAttention: false,
  toastStatus: presentGateScanStatus({
    busy: false,
    op: null,
    canReconcile: false,
  }),
  selectGateScope: noop,
  submitScan: noopAsync,
  handleCameraScan: noop,
  reconcile: noopAsync,
  syncNow: noopAsync,
  dismissPendingAction: noop,
  refreshGateEvents: noopAsync,
  logoutStaff: noopAsync,
};

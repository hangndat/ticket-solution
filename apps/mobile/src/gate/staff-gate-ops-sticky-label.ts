import type { GateOp } from './gate-scan';
import { machineOperationalLabel } from './staff-gate-scan-feedback';
import type { StaffGateScope } from './staff-gate-events';

export function buildMachineLabel(input: {
  busy: boolean;
  ready: boolean;
  gateEventsLoading: boolean;
  gateScope: StaffGateScope | null;
  pendingOp: GateOp | null;
  queuePendingCount: number;
}): string {
  return machineOperationalLabel({
    busy: input.busy,
    ready: input.ready,
    gateEventsLoading: input.gateEventsLoading,
    hasGateScope: Boolean(input.gateScope),
    pendingOp: input.pendingOp,
    queuePendingCount: input.queuePendingCount,
  });
}

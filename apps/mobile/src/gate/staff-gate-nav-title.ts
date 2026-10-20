import type { StaffGateScope } from './staff-gate-events';

/** Native nav bar title — selected gate event (shared across staff tabs). */
export function staffGateNavTitle(gate: {
  gateScope: StaffGateScope | null;
  gateEventsLoading: boolean;
  gateEventsError: string | null;
}): string {
  if (gate.gateEventsLoading) return 'Đang tải sự kiện…';
  if (gate.gateScope) return gate.gateScope.name;
  if (gate.gateEventsError) return gate.gateEventsError;
  return 'Chưa có sự kiện';
}

import type { StaffEligibilitySnapshot } from '@/identity/staff-eligibility';
import { isStaffWorkspace } from './staff-workspace.ts';

export type StaffGateTabPhase =
  | 'loading'
  | 'redirect-guest'
  | 'redirect-deny'
  | 'ready';

/** True only when gate tab routes may mount children (matches provider `active`). */
export function staffGateTabRendersChildren(phase: StaffGateTabPhase): boolean {
  return phase === 'ready';
}

/**
 * Fail-closed gate tab entry. Identity is checked before eligibility so logout
 * cannot mount staff screens under `Provider value={null}` (stale staffEligible).
 */
export function resolveStaffGateTabPhase(
  identityStatus: string,
  eligibility: StaffEligibilitySnapshot,
): StaffGateTabPhase {
  if (identityStatus !== 'verified') {
    return 'redirect-guest';
  }

  const identity = { status: identityStatus };
  if (isStaffWorkspace(identity, eligibility)) {
    return 'ready';
  }

  if (!eligibility.resolved || eligibility.loading) {
    return 'loading';
  }

  return 'redirect-deny';
}

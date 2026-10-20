import type { StaffEligibilitySnapshot } from '@/identity/staff-eligibility';

export type StaffGateTabPhase =
  | 'loading'
  | 'redirect-guest'
  | 'redirect-deny'
  | 'ready';

/**
 * Fail-closed gate tab entry. Signed-out must never mount staff screens even if
 * eligibility is briefly stale after logout (NativeTabs preloaded routes).
 */
export function resolveStaffGateTabPhase(
  identityStatus: string,
  eligibility: StaffEligibilitySnapshot,
): StaffGateTabPhase {
  if (identityStatus !== 'verified') {
    return 'redirect-guest';
  }
  if (!eligibility.resolved || eligibility.loading) {
    return 'loading';
  }
  if (!eligibility.staffEligible) {
    return 'redirect-deny';
  }
  return 'ready';
}

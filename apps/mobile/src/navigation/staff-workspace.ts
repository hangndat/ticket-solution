import type { StaffEligibilitySnapshot } from '@/identity/staff-eligibility';

type IdentityStatus = { status: string };

/**
 * Staff gate operators: hide attendee tabs (vé, tài khoản) and attendee-only flows.
 * Deny-by-default until MeEvents resolves staffEligible === true.
 */
export function isStaffWorkspace(
  identity: IdentityStatus,
  eligibility: StaffEligibilitySnapshot,
): boolean {
  return (
    identity.status === 'verified' &&
    eligibility.resolved &&
    eligibility.staffEligible === true
  );
}

export function showAttendeeTabs(
  identity: IdentityStatus,
  eligibility: StaffEligibilitySnapshot,
): boolean {
  return !isStaffWorkspace(identity, eligibility);
}

/** Guest: no NativeTabs. Verified attendee: Sự kiện (+ Vé). */
export function showAttendeeNativeTabs(
  identity: IdentityStatus,
  eligibility: StaffEligibilitySnapshot,
): boolean {
  return identity.status === 'verified' && showAttendeeTabs(identity, eligibility);
}

export function isGuestShell(identity: IdentityStatus): boolean {
  return identity.status !== 'verified';
}

import type { StaffEligibilitySnapshot } from '@/identity/staff-eligibility';
import { showAttendeeTabs } from './staff-workspace.ts';

type IdentitySnap = { status: string };
type OfflineSnap = { status: string };

/**
 * Wallet tab / deep routes: verified session or durable offline display binding.
 * Anonymous without offline binding has no access (tab hidden; deep links guarded).
 */
export function hasWalletAccess(
  identity: IdentitySnap,
  offline: OfflineSnap,
): boolean {
  if (identity.status === 'verified') return true;
  return offline.status === 'bound';
}

/** Attendee tab bar: show Vé của tôi only when wallet access policy allows. */
export function showMyTicketsTab(
  identity: IdentitySnap,
  eligibility: StaffEligibilitySnapshot,
  offline: OfflineSnap,
): boolean {
  if (!showAttendeeTabs(identity, eligibility)) return false;
  return hasWalletAccess(identity, offline);
}

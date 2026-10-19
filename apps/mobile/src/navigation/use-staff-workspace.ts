import { useSyncExternalStore } from 'react';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { isStaffWorkspace, showAttendeeTabs } from '@/navigation/staff-workspace';

export function useStaffWorkspace(): boolean {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const eligibility = useSyncExternalStore(
    staffEligibility.subscribe,
    staffEligibility.getSnapshot,
    staffEligibility.getSnapshot,
  );
  return isStaffWorkspace(identity, eligibility);
}

export function useShowAttendeeTabs(): boolean {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const eligibility = useSyncExternalStore(
    staffEligibility.subscribe,
    staffEligibility.getSnapshot,
    staffEligibility.getSnapshot,
  );
  return showAttendeeTabs(identity, eligibility);
}

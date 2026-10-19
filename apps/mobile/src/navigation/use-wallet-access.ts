import { useSyncExternalStore } from 'react';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { offlineDisplay } from '@/tickets/offline-display-session';
import {
  hasWalletAccess,
  showMyTicketsTab,
} from '@/navigation/attendee-wallet-access';

export function useWalletAccess(): { canAccess: boolean } {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const offline = useSyncExternalStore(
    offlineDisplay.subscribe,
    offlineDisplay.getSnapshot,
    offlineDisplay.getSnapshot,
  );
  return { canAccess: hasWalletAccess(identity, offline) };
}

export function useMyTicketsTabChrome(): { visible: boolean } {
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
  const offline = useSyncExternalStore(
    offlineDisplay.subscribe,
    offlineDisplay.getSnapshot,
    offlineDisplay.getSnapshot,
  );
  return {
    visible: showMyTicketsTab(identity, eligibility, offline),
  };
}

/** @deprecated Use useMyTicketsTabChrome */
export function useShowMyTicketsTab(): boolean {
  const { visible } = useMyTicketsTabChrome();
  return visible;
}

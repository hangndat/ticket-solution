import type { MeEventItem } from '@ticket/contracts';
import type { ShellLoadState } from '../nav/load-shell-context';

export function findMeEventAssignment(
  shell: ShellLoadState,
  tenantId: string,
  eventId: string,
): MeEventItem | null {
  if (shell.status !== 'ready') return null;
  return (
    shell.meEvents?.items.find(
      (item) => item.tenantId === tenantId && item.eventId === eventId,
    ) ?? null
  );
}

/** True when shell is ready, tenant is known, but MeEvents lacks the path event (stale discovery). */
export function shouldRefreshEventDiscovery(
  shell: ShellLoadState,
  tenantId: string,
  eventId: string,
): boolean {
  if (shell.status !== 'ready') return false;
  const tenant =
    shell.meTenants?.items.find((item) => item.tenantId === tenantId) ?? null;
  if (!tenant) return false;
  return findMeEventAssignment(shell, tenantId, eventId) == null;
}

const DISCOVERY_RETRY_DELAYS_MS = [0, 150, 350, 700, 1200];

export async function refreshUntilEventAssigned(
  tenantId: string,
  eventId: string,
  refresh: () => Promise<ShellLoadState>,
): Promise<ShellLoadState> {
  let last = await refresh();
  for (const delay of DISCOVERY_RETRY_DELAYS_MS) {
    if (!shouldRefreshEventDiscovery(last, tenantId, eventId)) return last;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    last = await refresh();
  }
  return last;
}

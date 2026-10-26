import type { ShellLoadState } from '../nav/load-shell-context';

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
  const assigned =
    shell.meEvents?.items.some(
      (item) => item.tenantId === tenantId && item.eventId === eventId,
    ) ?? false;
  return !assigned;
}

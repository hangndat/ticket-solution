import type { TicketSummary } from '@ticket/contracts';
import { getTenantId } from '../identity/config.ts';

/** In-memory session cache key for owner-wide wallet (not a tenant UUID). */
export const WALLET_OWNER_SESSION_SCOPE = '__owner__';

/** SecureStore envelope scope for aggregated ticket list (not a tenant UUID). */
export const WALLET_OWNER_CACHE_SCOPE = '__owner_aggregate__';

export type MeTicketsFetchScope =
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'owner' };

export function walletFetchScopeFromEnv(): MeTicketsFetchScope {
  const configured = getTenantId()?.trim();
  if (configured) {
    return { kind: 'tenant', tenantId: configured };
  }
  return { kind: 'owner' };
}

export function walletSessionScope(scope: MeTicketsFetchScope): string {
  return scope.kind === 'tenant' ? scope.tenantId : WALLET_OWNER_SESSION_SCOPE;
}

export function walletDisplayCacheScope(scope: MeTicketsFetchScope): string {
  return scope.kind === 'tenant' ? scope.tenantId : WALLET_OWNER_CACHE_SCOPE;
}

export function normalizeMeTicketsFetchScope(
  scope: MeTicketsFetchScope | string,
): MeTicketsFetchScope | null {
  if (typeof scope === 'string') {
    const tenantId = scope.trim();
    if (!tenantId) return null;
    return { kind: 'tenant', tenantId };
  }
  if (scope.kind === 'tenant' && !scope.tenantId.trim()) return null;
  return scope;
}

export function groupTicketsByTenantId(
  tickets: TicketSummary[],
): Map<string, TicketSummary[]> {
  const map = new Map<string, TicketSummary[]>();
  for (const row of tickets) {
    const tid = row.tenantId?.trim();
    if (!tid) continue;
    const list = map.get(tid) ?? [];
    list.push(row);
    map.set(tid, list);
  }
  return map;
}

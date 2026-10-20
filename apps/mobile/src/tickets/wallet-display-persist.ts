import type { TicketSummary } from '@ticket/contracts';
import type { MeTicketsFetchScope } from './wallet-fetch-scope.ts';
import {
  WALLET_OWNER_CACHE_SCOPE,
  groupTicketsByTenantId,
  walletDisplayCacheScope,
} from './wallet-fetch-scope.ts';
import {
  clearTicketDisplayCache,
  writeTicketDisplayCache,
} from './display-cache.ts';

/**
 * Persist probe results: owner aggregate + per-tenant slices from row.tenantId.
 * Filter mode writes a single tenant cache only.
 */
export async function persistWalletTicketCaches(
  userId: string,
  scope: MeTicketsFetchScope,
  tickets: TicketSummary[],
  syncedAt: string,
  writeEpoch: number,
): Promise<boolean> {
  if (scope.kind === 'tenant') {
    return writeTicketDisplayCache(
      {
        userId,
        tenantId: scope.tenantId,
        syncedAt,
        tickets,
      },
      writeEpoch,
    );
  }

  let ok = await writeTicketDisplayCache(
    {
      userId,
      tenantId: WALLET_OWNER_CACHE_SCOPE,
      syncedAt,
      tickets,
    },
    writeEpoch,
  );

  for (const [tenantId, group] of groupTicketsByTenantId(tickets)) {
    const sliceOk = await writeTicketDisplayCache(
      {
        userId,
        tenantId,
        syncedAt,
        tickets: group,
      },
      writeEpoch,
    );
    ok = ok && sliceOk;
  }
  return ok;
}

export async function clearWalletDisplayCaches(
  userId: string,
  scope: MeTicketsFetchScope,
  ticketTenantIds: Iterable<string> = [],
): Promise<void> {
  const keys = new Set<string>([walletDisplayCacheScope(scope)]);
  for (const tid of ticketTenantIds) {
    const trimmed = tid.trim();
    if (trimmed) keys.add(trimmed);
  }
  if (scope.kind === 'owner') {
    keys.add(WALLET_OWNER_CACHE_SCOPE);
  }
  for (const key of keys) {
    await clearTicketDisplayCache(userId, key);
  }
}

import type { TicketSummary } from '@ticket/contracts';
import type { MeTicketsFetchScope } from './wallet-fetch-scope.ts';
import {
  WALLET_OWNER_CACHE_SCOPE,
  groupTicketsByTenantId,
} from './wallet-fetch-scope.ts';
import {
  clearTicketDisplayCache,
  readTicketDisplayCache,
  writeTicketDisplayCache,
} from './display-cache.ts';
import { clearWalletLogoutCaches, type WalletLogoutCacheInput } from './wallet-logout-cache.ts';

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
  input: WalletLogoutCacheInput,
): Promise<void> {
  await clearWalletLogoutCaches(input, {
    read: readTicketDisplayCache,
    clear: clearTicketDisplayCache,
  });
}

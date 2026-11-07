import type { TicketDisplayCache } from './display-cache-types.ts';
import type { MeTicketsFetchScope } from './wallet-fetch-scope.ts';
import { WALLET_OWNER_CACHE_SCOPE } from './wallet-fetch-scope.ts';

export type WalletLogoutCacheInput = {
  userId: string;
  tenantId?: string | null;
  walletScope?: MeTicketsFetchScope | null;
  ticketTenantIds?: Iterable<string>;
};

export type WalletLogoutCacheStore = {
  read: (userId: string, scope: string) => Promise<TicketDisplayCache | null>;
  clear: (userId: string, scope: string) => Promise<void>;
};

/** Account knows the owner but may not have the wallet's last fetch scope. */
export async function clearWalletLogoutCaches(
  input: WalletLogoutCacheInput,
  store: WalletLogoutCacheStore,
): Promise<void> {
  const scopes = new Set<string>([WALLET_OWNER_CACHE_SCOPE]);
  const addTenant = (tenantId: string | null | undefined) => {
    const value = tenantId?.trim();
    if (value && value !== WALLET_OWNER_CACHE_SCOPE) scopes.add(value);
  };
  addTenant(input.tenantId);
  if (input.walletScope?.kind === 'tenant') addTenant(input.walletScope.tenantId);
  for (const tenantId of input.ticketTenantIds ?? []) addTenant(tenantId);

  let readFailed = false;
  let readFailure: unknown;
  try {
    const aggregate = await store.read(input.userId, WALLET_OWNER_CACHE_SCOPE);
    if (aggregate?.userId === input.userId && aggregate.tenantId === WALLET_OWNER_CACHE_SCOPE) {
      for (const ticket of aggregate.tickets) addTenant(ticket.tenantId);
    }
  } catch (error) {
    readFailed = true;
    readFailure = error;
  }

  const deleteFailures: unknown[] = [];
  for (const scope of scopes) {
    try {
      await store.clear(input.userId, scope);
    } catch (error) {
      deleteFailures.push(error);
    }
  }
  if (readFailed || deleteFailures.length) {
    throw new Error('Chưa xóa hết dữ liệu vé trên thiết bị.', {
      cause: readFailure ?? deleteFailures[0],
    });
  }
}

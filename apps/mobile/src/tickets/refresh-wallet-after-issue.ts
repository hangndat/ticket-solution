import { session } from '../identity/session.ts';
import { applyIssuedWalletRefresh } from './apply-issued-wallet-refresh.ts';
import { currentTicketDisplayWriteEpoch } from './display-cache.ts';
import { probeMeTickets } from './fetch-me-tickets.ts';
import { persistWalletTicketCaches } from './wallet-display-persist.ts';
import { walletFetchScopeFromEnv } from './wallet-fetch-scope.ts';

export { applyIssuedWalletRefresh } from './apply-issued-wallet-refresh.ts';

/** Probe + replace in-memory and durable ví caches after a successful issue. */
export async function refreshWalletAfterIssue(): Promise<boolean> {
  const epoch = session.captureEpoch();
  const bearer = await session.getCredential();
  if (!epoch || !bearer) return false;
  const fetchScope = walletFetchScopeFromEnv();
  const probe = await probeMeTickets(bearer, fetchScope);
  return applyIssuedWalletRefresh({
    userId: epoch.userId,
    fetchScope,
    probe,
    load: (scope, resource, loader) => session.load(scope, resource, loader),
    persist: persistWalletTicketCaches,
    nowIso: new Date().toISOString(),
    writeEpoch: currentTicketDisplayWriteEpoch(),
  });
}

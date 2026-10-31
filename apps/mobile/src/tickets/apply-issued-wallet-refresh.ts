import type { TicketSummary } from '@ticket/contracts';
import type { MeTicketsProbeResult } from './fetch-me-tickets.ts';
import {
  type MeTicketsFetchScope,
  walletSessionScope,
} from './wallet-fetch-scope.ts';

export async function applyIssuedWalletRefresh(input: {
  userId: string;
  fetchScope: MeTicketsFetchScope;
  probe: MeTicketsProbeResult;
  load: (
    scope: string,
    resource: string,
    loader: () => Promise<TicketSummary[]>,
  ) => Promise<boolean | void>;
  persist: (
    userId: string,
    scope: MeTicketsFetchScope,
    tickets: TicketSummary[],
    syncedAt: string,
    writeEpoch: number,
  ) => Promise<boolean>;
  nowIso: string;
  writeEpoch: number;
}): Promise<boolean> {
  if (input.probe.status !== 'ok') return false;
  const tickets = input.probe.body.tickets;
  const sessionScope = walletSessionScope(input.fetchScope);
  await input.load(sessionScope, 'me-tickets', async () => tickets);
  return input.persist(
    input.userId,
    input.fetchScope,
    tickets,
    input.nowIso,
    input.writeEpoch,
  );
}

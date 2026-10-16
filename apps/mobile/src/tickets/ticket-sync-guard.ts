import type { TicketSummary } from '@ticket/contracts';
import type { SessionEpoch } from '../identity/session-boundary.ts';
import type { TicketDisplayCache } from './display-cache-types.ts';
import type { MeTicketsProbeResult } from './fetch-me-tickets.ts';

export type TicketSyncApplyResult =
  | {
      action: 'apply';
      tickets: TicketSummary[];
      syncedAt: string;
      offline: false;
    }
  | {
      action: 'offline-cache';
      tickets: TicketSummary[];
      syncedAt: string;
      offline: true;
      notice: string;
    }
  | { action: 'unauthorized' }
  | { action: 'stale' }
  | { action: 'error'; message: string };

/**
 * Pure decision for applying a tickets probe under an epoch guard.
 * Never falls back to cache on unauthorized; stale epochs are dropped.
 */
export function decideTicketSyncApply(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
  probe: MeTicketsProbeResult;
  cached: TicketDisplayCache | null;
  expectedUserId: string;
}): TicketSyncApplyResult {
  if (!input.isEpochCurrent(input.epoch)) {
    return { action: 'stale' };
  }
  if (input.probe.status === 'unauthorized') {
    return { action: 'unauthorized' };
  }
  if (input.probe.status === 'ok') {
    if (!input.isEpochCurrent(input.epoch)) return { action: 'stale' };
    return {
      action: 'apply',
      tickets: input.probe.body.tickets,
      syncedAt: new Date().toISOString(),
      offline: false,
    };
  }
  // unreachable / invalid — offline display cache only for the epoch user
  if (
    input.cached &&
    input.cached.userId === input.expectedUserId &&
    input.isEpochCurrent(input.epoch)
  ) {
    return {
      action: 'offline-cache',
      tickets: input.cached.tickets,
      syncedAt: input.cached.syncedAt,
      offline: true,
      notice:
        'Could not refresh from API. Showing last offline display cache. Status may have changed.',
    };
  }
  if (!input.isEpochCurrent(input.epoch)) return { action: 'stale' };
  return {
    action: 'error',
    message:
      input.probe.status === 'unreachable'
        ? 'GET /v1/me/tickets unreachable. No offline display cache for this account.'
        : 'GET /v1/me/tickets failed. Check API base URL, tenantId, and that Nest is running.',
  };
}

/**
 * Hydrate decision: only apply cache when epoch still matches the cache user.
 */
export function decideCacheHydrate(input: {
  epoch: SessionEpoch | null;
  isEpochCurrent: (epoch: SessionEpoch | null) => boolean;
  cached: TicketDisplayCache | null;
  expectedUserId: string;
}):
  | { action: 'apply'; tickets: TicketSummary[]; syncedAt: string }
  | { action: 'stale' }
  | { action: 'skip' } {
  if (!input.isEpochCurrent(input.epoch)) return { action: 'stale' };
  if (!input.cached || input.cached.userId !== input.expectedUserId) {
    return { action: 'skip' };
  }
  if (!input.isEpochCurrent(input.epoch)) return { action: 'stale' };
  return {
    action: 'apply',
    tickets: input.cached.tickets,
    syncedAt: input.cached.syncedAt,
  };
}

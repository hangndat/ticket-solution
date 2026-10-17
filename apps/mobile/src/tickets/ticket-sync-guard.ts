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
        'Không làm mới được từ API. Đang hiện bộ đệm hiển thị offline gần nhất. Trạng thái có thể đã đổi.',
    };
  }
  if (!input.isEpochCurrent(input.epoch)) return { action: 'stale' };
  return {
    action: 'error',
    message:
      input.probe.status === 'unreachable'
        ? 'GET /v1/me/tickets không tới được. Không có bộ đệm hiển thị offline cho tài khoản này.'
        : 'GET /v1/me/tickets thất bại. Kiểm tra API base URL, tenantId và Nest đang chạy.',
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

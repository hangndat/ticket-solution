/**
 * Pure helpers for Events home published-first UX (ADR-19 / #257).
 * Fail-closed: never map API failure onto demo fixtures.
 */

import type { FetchPublishedListResult } from './published-event-api.ts';
import type { PublishedEventSummary } from './types.ts';

export type PublishedListPhase =
  | 'loading'
  | 'ready'
  | 'error'
  | 'misconfigured';

export type PublishedListUiState = {
  phase: PublishedListPhase;
  items: PublishedEventSummary[];
  errorMessage: string | null;
};

export const PUBLISHED_LIST_FAIL_CLOSED_MESSAGE =
  'Không tải được danh sách đã xuất bản — không dùng demo thay thế.';

export function initialPublishedListPhase(
  hasApiBaseUrl: boolean,
): PublishedListPhase {
  return hasApiBaseUrl ? 'loading' : 'misconfigured';
}

/** Map fetchPublishedEventList result → UI state (no fixture fallback). */
export function publishedListStateFromResult(
  result: FetchPublishedListResult,
): PublishedListUiState {
  if (result.status === 'ok') {
    return {
      phase: 'ready',
      items: result.body.items,
      errorMessage: null,
    };
  }
  if (result.status === 'misconfigured') {
    return {
      phase: 'misconfigured',
      items: [],
      errorMessage: 'Thiếu URL API',
    };
  }
  return {
    phase: 'error',
    items: [],
    errorMessage: PUBLISHED_LIST_FAIL_CLOSED_MESSAGE,
  };
}

export const DEMO_PUBLISHED_TENANTS = ['mfest-demo', 'demo-studio'] as const;

export function nextDemoPublishedTenant(
  current: string,
): (typeof DEMO_PUBLISHED_TENANTS)[number] {
  return current === DEMO_PUBLISHED_TENANTS[0]
    ? DEMO_PUBLISHED_TENANTS[1]
    : DEMO_PUBLISHED_TENANTS[0];
}

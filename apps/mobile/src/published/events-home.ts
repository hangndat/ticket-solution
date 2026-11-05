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
  catalogConfigured: boolean,
): PublishedListPhase {
  return catalogConfigured ? 'loading' : 'misconfigured';
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
      errorMessage: 'Không thể tải danh sách sự kiện',
    };
  }
  return {
    phase: 'error',
    items: [],
    errorMessage: PUBLISHED_LIST_FAIL_CLOSED_MESSAGE,
  };
}

/** Search the loaded published page; never turn a failed fetch into an empty catalog. */
export function selectPublishedCatalog(
  items: PublishedEventSummary[],
  query: string,
  now = Date.now(),
): {
  matches: PublishedEventSummary[];
  emptyKind: 'catalog' | 'search' | null;
} {
  const normalized = query.trim().toLocaleLowerCase('vi');
  const matches = items.filter((item) =>
    [item.name, item.brand.organizationName, item.location ?? '']
      .join(' ').toLocaleLowerCase('vi').includes(normalized),
  );
  const rank = (item: PublishedEventSummary) => {
    const time = item.startsAt ? Date.parse(item.startsAt) : NaN;
    return Number.isFinite(time) && time >= now ? time : Infinity;
  };
  matches.sort((a, b) => rank(a) - rank(b));
  return {
    matches,
    emptyKind: matches.length ? null : normalized ? 'search' : 'catalog',
  };
}


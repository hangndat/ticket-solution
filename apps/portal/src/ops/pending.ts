/**
 * G-R2 pending redemption list interpreters — fail-closed on raw PII.
 */

import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  optionalString,
} from './contract-shape';
import type { AdminScope } from './scope';
import { eventPath } from './scope';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

export const PENDING_UNKNOWN = t(DEFAULT_PORTAL_LOCALE, 'ops.pending.unknown');

export type PendingItem = {
  requestId: string;
  status: 'PENDING_REVIEW';
  sourceId: string | null;
  ticketTypeId: string | null;
  createdAt: string | null;
};

export type PendingView =
  | { kind: 'list'; items: PendingItem[]; nextCursor: string | null }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export function pendingListPath(
  scope: AdminScope,
  query?: {
    cursor?: string;
    limit?: number;
    status?: 'PENDING_REVIEW';
    sourceId?: string;
    ticketTypeId?: string;
    q?: string;
  },
): string {
  const base = eventPath(scope, 'redemptions');
  const params = new URLSearchParams();
  if (query?.cursor) params.set('cursor', query.cursor);
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  if (query?.status) params.set('status', query.status);
  if (query?.sourceId) params.set('sourceId', query.sourceId);
  if (query?.ticketTypeId) params.set('ticketTypeId', query.ticketTypeId);
  if (query?.q) params.set('q', query.q);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function parseItem(raw: unknown): PendingItem | null {
  const body = asRecord(raw);
  if (!body) return null;
  if (!isNonEmptyString(body.requestId)) return null;
  // Fail closed on attendee PII / tokens.
  if (
    'ownerEmail' in body ||
    'email' in body ||
    'phone' in body ||
    'token' in body ||
    'rawCode' in body
  ) {
    return null;
  }
  const status = body.status;
  if (status !== 'PENDING_REVIEW' && status !== undefined) {
    // List is pending-only; reject unexpected statuses.
    if (typeof status === 'string' && status !== 'PENDING_REVIEW') return null;
  }
  return {
    requestId: body.requestId.trim(),
    status: 'PENDING_REVIEW',
    sourceId: optionalString(body.sourceId),
    ticketTypeId: optionalString(body.ticketTypeId),
    createdAt: optionalString(body.createdAt),
  };
}

export function interpretPendingList(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PendingView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.pending.unknown') };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (!body || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: t(locale, 'ops.pending.unknown') };
    }
    const items: PendingItem[] = [];
    for (const row of body.items) {
      const item = parseItem(row);
      if (!item) {
        return { kind: 'unknown', message: t(locale, 'ops.pending.unknown') };
      }
      items.push(item);
    }
    const nextCursor =
      typeof body.nextCursor === 'string' && body.nextCursor.trim()
        ? body.nextCursor.trim()
        : null;
    return { kind: 'list', items, nextCursor };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.pending.unknown') };
}

export function pendingListLabel(
  view: PendingView,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string {
  if (view.kind === 'list') {
    return t(locale, 'ops.pending.listSummary', {
      count: view.items.length,
      pageSuffix: view.nextCursor
        ? t(locale, 'common.pagination.pageSuffix')
        : '',
    });
  }
  if (view.kind === 'rejected') {
    return t(locale, 'ops.export.apiRejected', {
      code: view.code,
      message: view.message,
    });
  }
  return view.message;
}

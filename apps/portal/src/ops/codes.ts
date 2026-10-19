/**
 * H-C1 — codes inventory browse interpreter.
 * Never accept raw code / HMAC / fabricated suffix; never echo `q`.
 */

import type {
  PortalCodeState,
  PortalCodeSummary,
  PortalCodesPage,
} from '@ticket/contracts';
import { asRecord, isNonEmptyString, apiErrorFrom } from './contract-shape';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

const CODE_FORBIDDEN = [
  'code_hmac',
  'codeHmac',
  'rawCode',
  'code',
  'suffix',
  'pepper',
  'token',
  'email',
  'q',
] as const;

const CODE_STATES = new Set<PortalCodeState>([
  'AVAILABLE',
  'HELD',
  'CONSUMED',
]);

export const CODES_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.h_1rrwe0k');

export type CodesListView =
  | { kind: 'page'; page: PortalCodesPage }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function parseCodeSummary(raw: unknown): PortalCodeSummary | null {
  const row = asRecord(raw);
  if (!row) return null;
  for (const key of CODE_FORBIDDEN) {
    if (key in row) return null;
  }
  if (
    !isNonEmptyString(row.codeId) ||
    !isNonEmptyString(row.sourceId) ||
    !isNonEmptyString(row.ticketTypeId)
  ) {
    return null;
  }
  if (typeof row.state !== 'string' || !CODE_STATES.has(row.state as PortalCodeState)) {
    return null;
  }
  return {
    codeId: row.codeId.trim(),
    state: row.state as PortalCodeState,
    sourceId: row.sourceId.trim(),
    ticketTypeId: row.ticketTypeId.trim(),
  };
}

export function interpretCodesPage(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): CodesListView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.h_1rrwe0k') };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (
      !body ||
      !Array.isArray(body.items) ||
      ('total' in body && body.total != null)
    ) {
      return { kind: 'unknown', message: t(locale, 'ops.h_1rrwe0k') };
    }
    // Response must never echo lookup query.
    if ('q' in body) {
      return { kind: 'unknown', message: t(locale, 'ops.h_1rrwe0k') };
    }
    const items: PortalCodeSummary[] = [];
    for (const raw of body.items) {
      const item = parseCodeSummary(raw);
      if (!item) return { kind: 'unknown', message: t(locale, 'ops.h_1rrwe0k') };
      items.push(item);
    }
    const nextCursor =
      body.nextCursor === null
        ? null
        : typeof body.nextCursor === 'string'
          ? body.nextCursor
          : null;
    if (
      body.nextCursor !== null &&
      body.nextCursor !== undefined &&
      typeof body.nextCursor !== 'string'
    ) {
      return { kind: 'unknown', message: t(locale, 'ops.h_1rrwe0k') };
    }
    return { kind: 'page', page: { items, nextCursor } };
  }
  if (status === 401 || status === 403) {
    const err = apiErrorFrom(asRecord(json));
    return {
      kind: 'rejected',
      code: err?.code ?? 'FORBIDDEN',
      message:
        err?.message ??
        t(locale, 'ops.codes.needImport'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.h_1rrwe0k') };
}

export function buildCodesQuery(input: {
  cursor?: string | null;
  limit?: number;
  state?: PortalCodeState | '';
  sourceId?: string;
  ticketTypeId?: string;
  /** Exact code — hashed server-side; never logged or shown in results. */
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.limit != null) params.set('limit', String(input.limit));
  if (input.state) params.set('state', input.state);
  if (input.sourceId?.trim()) params.set('sourceId', input.sourceId.trim());
  if (input.ticketTypeId?.trim()) {
    params.set('ticketTypeId', input.ticketTypeId.trim());
  }
  if (input.q?.trim()) params.set('q', input.q.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

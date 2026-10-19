/**
 * H-A1 / H-P-AUDIT — fail-closed audit list interpreters (ADR-20 §7.1).
 * Reject rows that carry reason/diff/PII/HMAC fields.
 */

import type {
  PortalAuditEntry,
  PortalAuditPage,
  PortalPlatformAuditEntry,
  PortalPlatformAuditPage,
} from '@ticket/contracts';
import { asRecord, isNonEmptyString, apiErrorFrom } from './contract-shape';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

const AUDIT_FORBIDDEN = [
  'reason',
  'reasonCode',
  'sanitizedDiff',
  'sanitized_diff',
  'code_hmac',
  'codeHmac',
  'rawCode',
  'email',
  'phone',
  'token',
  'ownerEmail',
  'invitedEmail',
] as const;

export const AUDIT_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.h_1plfzsb');

export type AuditListView =
  | { kind: 'page'; page: PortalAuditPage }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type PlatformAuditListView =
  | { kind: 'page'; page: PortalPlatformAuditPage }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function hasForbidden(row: Record<string, unknown>): boolean {
  return AUDIT_FORBIDDEN.some((key) => key in row);
}

function parseAuditEntry(raw: unknown): PortalAuditEntry | null {
  const row = asRecord(raw);
  if (!row || hasForbidden(row)) return null;
  if (!isNonEmptyString(row.auditId) || !isNonEmptyString(row.action)) {
    return null;
  }
  if (
    !isNonEmptyString(row.resourceType) ||
    !isNonEmptyString(row.createdAt)
  ) {
    return null;
  }
  return {
    auditId: row.auditId.trim(),
    actorUserId:
      typeof row.actorUserId === 'string' ? row.actorUserId.trim() : null,
    action: row.action.trim(),
    resourceType: row.resourceType.trim(),
    resourceId:
      typeof row.resourceId === 'string' ? row.resourceId.trim() : null,
    operationId:
      typeof row.operationId === 'string' ? row.operationId.trim() : null,
    createdAt: row.createdAt.trim(),
  };
}

function parsePlatformAuditEntry(
  raw: unknown,
): PortalPlatformAuditEntry | null {
  const row = asRecord(raw);
  if (!row || hasForbidden(row)) return null;
  if (!isNonEmptyString(row.auditId) || !isNonEmptyString(row.action)) {
    return null;
  }
  if (
    !isNonEmptyString(row.resourceType) ||
    !isNonEmptyString(row.createdAt)
  ) {
    return null;
  }
  return {
    auditId: row.auditId.trim(),
    actorUserId:
      typeof row.actorUserId === 'string' ? row.actorUserId.trim() : null,
    action: row.action.trim(),
    resourceType: row.resourceType.trim(),
    resourceId:
      typeof row.resourceId === 'string' ? row.resourceId.trim() : null,
    tenantId: typeof row.tenantId === 'string' ? row.tenantId.trim() : null,
    createdAt: row.createdAt.trim(),
  };
}

function parseCursorPage<T>(
  json: unknown,
  parseItem: (raw: unknown) => T | null,
): { items: T[]; nextCursor: string | null } | null {
  const body = asRecord(json);
  if (!body || !Array.isArray(body.items)) return null;
  if ('total' in body && body.total != null) return null;
  const items: T[] = [];
  for (const raw of body.items) {
    const item = parseItem(raw);
    if (!item) return null;
    items.push(item);
  }
  const nextCursor =
    body.nextCursor === null
      ? null
      : typeof body.nextCursor === 'string'
        ? body.nextCursor
        : null;
  if (body.nextCursor !== null && body.nextCursor !== undefined) {
    if (typeof body.nextCursor !== 'string') return null;
  }
  return { items, nextCursor };
}

export function interpretAuditPage(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): AuditListView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.h_1plfzsb') };
  }
  if (status === 200) {
    const page = parseCursorPage(json, parseAuditEntry);
    if (page) return { kind: 'page', page };
    return { kind: 'unknown', message: t(locale, 'ops.h_1plfzsb') };
  }
  if (status === 401 || status === 403) {
    const err = apiErrorFrom(asRecord(json));
    return {
      kind: 'rejected',
      code: err?.code ?? 'FORBIDDEN',
      message:
        err?.message ??
        t(locale, 'ops.audit.needReportReadAssignment'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.h_1plfzsb') };
}

export function interpretPlatformAuditPage(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PlatformAuditListView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.h_1plfzsb') };
  }
  if (status === 200) {
    const page = parseCursorPage(json, parsePlatformAuditEntry);
    if (page) return { kind: 'page', page };
    return { kind: 'unknown', message: t(locale, 'ops.h_1plfzsb') };
  }
  if (status === 401 || status === 403) {
    const err = apiErrorFrom(asRecord(json));
    return {
      kind: 'rejected',
      code: err?.code ?? 'FORBIDDEN',
      message:
        err?.message ??
        t(locale, 'platform.staffTokenRejected'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.h_1plfzsb') };
}

export function buildAuditQuery(input: {
  cursor?: string | null;
  limit?: number;
  from?: string;
  to?: string;
  action?: string;
  tenantId?: string;
}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.limit != null) params.set('limit', String(input.limit));
  if (input.from?.trim()) params.set('from', input.from.trim());
  if (input.to?.trim()) params.set('to', input.to.trim());
  if (input.action?.trim()) params.set('action', input.action.trim());
  if (input.tenantId?.trim()) params.set('tenantId', input.tenantId.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

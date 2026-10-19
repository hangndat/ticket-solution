/**
 * PLATFORM-PORTAL-ZONE — tenants list (H-P1), health (H-P2), support revoke.
 * Staff token must never unlock these projections client-side.
 */

import type {
  PortalPlatformTenantHealth,
  PortalPlatformTenantSummary,
  PortalPlatformTenantsPage,
  TenantStatus,
} from '@ticket/contracts';
import { asRecord, isNonEmptyString, apiErrorFrom } from './contract-shape';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

const TENANT_STATUSES = new Set<TenantStatus>([
  'ACTIVE',
  'SUSPENDED',
  'PENDING',
]);

const TENANT_FORBIDDEN = [
  'limits',
  'flags',
  'ownerEmail',
  'billing',
  'secret',
  'token',
] as const;

export const PLATFORM_TENANTS_UNKNOWN = t(
  DEFAULT_PORTAL_LOCALE,
  'platform.h_usltan',
);

export type PlatformTenantsView =
  | { kind: 'page'; page: PortalPlatformTenantsPage }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function parseTenant(raw: unknown): PortalPlatformTenantSummary | null {
  const row = asRecord(raw);
  if (!row) return null;
  for (const key of TENANT_FORBIDDEN) {
    if (key in row) return null;
  }
  if (
    !isNonEmptyString(row.tenantId) ||
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.name) ||
    !isNonEmptyString(row.createdAt)
  ) {
    return null;
  }
  if (
    typeof row.status !== 'string' ||
    !TENANT_STATUSES.has(row.status as TenantStatus)
  ) {
    return null;
  }
  if (typeof row.version !== 'number' || !Number.isFinite(row.version)) {
    return null;
  }
  return {
    tenantId: row.tenantId.trim(),
    slug: row.slug.trim(),
    name: row.name.trim(),
    status: row.status as TenantStatus,
    version: row.version,
    createdAt: row.createdAt.trim(),
  };
}

export function interpretPlatformTenantsPage(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PlatformTenantsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'platform.h_usltan') };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (!body || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: t(locale, 'platform.h_usltan') };
    }
    const items: PortalPlatformTenantSummary[] = [];
    for (const raw of body.items) {
      const item = parseTenant(raw);
      if (!item)
        return { kind: 'unknown', message: t(locale, 'platform.h_usltan') };
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
      return { kind: 'unknown', message: t(locale, 'platform.h_usltan') };
    }
    return { kind: 'page', page: { items, nextCursor } };
  }
  if (status === 401 || status === 403) {
    const err = apiErrorFrom(asRecord(json));
    return {
      kind: 'rejected',
      code: err?.code ?? 'FORBIDDEN',
      message: err?.message ?? t(locale, 'platform.operatorMfaOnly'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'platform.h_usltan') };
}

export function buildPlatformListQuery(input: {
  cursor?: string | null;
  limit?: number;
}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.limit != null) params.set('limit', String(input.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Keys that must never appear on H-P2 health (payloads / fake SLA / infra). */
const HEALTH_FORBIDDEN = [
  'email',
  'recipient',
  'payload',
  'providerPayload',
  'rawError',
  'errorMessage',
  'smtp',
  'redis',
  'database',
  'dbUp',
  'sla',
  'success',
  'latencyMs',
  'secret',
  'token',
] as const;

export const PLATFORM_HEALTH_UNKNOWN = t(
  DEFAULT_PORTAL_LOCALE,
  'platform.h_de965r',
);

export type PlatformHealthView =
  | { kind: 'ok'; health: PortalPlatformTenantHealth }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

function parseNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value) === value ? value : null;
}

function parseHealth(raw: unknown): PortalPlatformTenantHealth | null {
  const body = asRecord(raw);
  if (!body) return null;
  for (const key of HEALTH_FORBIDDEN) {
    if (key in body) return null;
  }
  if (!isNonEmptyString(body.tenantId) || !isNonEmptyString(body.observedAt)) {
    return null;
  }
  const notifications = asRecord(body.notifications);
  const outbox = asRecord(body.outbox);
  const usage = asRecord(body.usage);
  if (!notifications || !outbox || !usage) return null;
  for (const bag of [notifications, outbox, usage]) {
    for (const key of HEALTH_FORBIDDEN) {
      if (key in bag) return null;
    }
  }
  const nPending = parseNonNegInt(notifications.pending);
  const nFailed = parseNonNegInt(notifications.failed);
  const nDead = parseNonNegInt(notifications.dead);
  const oPending = parseNonNegInt(outbox.pending);
  const oFailed = parseNonNegInt(outbox.failed);
  const uEvents = parseNonNegInt(usage.events);
  const uStaff = parseNonNegInt(usage.staffActive);
  const uInvites = parseNonNegInt(usage.staffPendingInvites);
  const uEmail = parseNonNegInt(usage.emailToday);
  if (
    nPending === null ||
    nFailed === null ||
    nDead === null ||
    oPending === null ||
    oFailed === null ||
    uEvents === null ||
    uStaff === null ||
    uInvites === null ||
    uEmail === null
  ) {
    return null;
  }
  return {
    tenantId: body.tenantId.trim(),
    observedAt: body.observedAt.trim(),
    notifications: { pending: nPending, failed: nFailed, dead: nDead },
    outbox: { pending: oPending, failed: oFailed },
    usage: {
      events: uEvents,
      staffActive: uStaff,
      staffPendingInvites: uInvites,
      emailToday: uEmail,
    },
  };
}

export function interpretPlatformTenantHealth(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PlatformHealthView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'platform.h_de965r') };
  }
  if (status === 200) {
    const health = parseHealth(json);
    if (!health) {
      return { kind: 'unknown', message: t(locale, 'platform.h_de965r') };
    }
    return { kind: 'ok', health };
  }
  if (status === 401 || status === 403) {
    const err = apiErrorFrom(asRecord(json));
    return {
      kind: 'rejected',
      code: err?.code ?? 'FORBIDDEN',
      message: err?.message ?? t(locale, 'platform.operatorMfaOnly'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'platform.h_de965r') };
}

export type SupportGrantRevokeResult = {
  grantId: string;
  revokedAt: string;
};

export const PLATFORM_REVOKE_UNKNOWN = t(
  DEFAULT_PORTAL_LOCALE,
  'platform.h_1vi2x57',
);

export type PlatformRevokeView =
  | { kind: 'ok'; result: SupportGrantRevokeResult }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export function interpretSupportGrantRevoke(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PlatformRevokeView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'platform.h_1vi2x57') };
  }
  if (status === 200 || status === 201) {
    const body = asRecord(json);
    if (
      !body ||
      !isNonEmptyString(body.grantId) ||
      !isNonEmptyString(body.revokedAt)
    ) {
      return { kind: 'unknown', message: t(locale, 'platform.h_1vi2x57') };
    }
    return {
      kind: 'ok',
      result: {
        grantId: body.grantId.trim(),
        revokedAt: body.revokedAt.trim(),
      },
    };
  }
  if (status === 401 || status === 403) {
    const err = apiErrorFrom(asRecord(json));
    return {
      kind: 'rejected',
      code: err?.code ?? 'FORBIDDEN',
      message: err?.message ?? t(locale, 'platform.operatorMfaOnly'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'platform.h_1vi2x57') };
}

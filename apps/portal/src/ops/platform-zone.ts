/**
 * PLATFORM-PORTAL-ZONE — tenants list (H-P1) interpreters.
 * Staff token must never unlock these projections client-side.
 */

import type {
  PortalPlatformTenantSummary,
  PortalPlatformTenantsPage,
  TenantStatus,
} from '@ticket/contracts';
import { asRecord, isNonEmptyString, apiErrorFrom } from './contract-shape';

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

export const PLATFORM_TENANTS_UNKNOWN =
  'Không đọc được danh sách tenant platform. Không coi list đã tải thành công.';

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
): PlatformTenantsView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: PLATFORM_TENANTS_UNKNOWN };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (!body || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: PLATFORM_TENANTS_UNKNOWN };
    }
    const items: PortalPlatformTenantSummary[] = [];
    for (const raw of body.items) {
      const item = parseTenant(raw);
      if (!item) return { kind: 'unknown', message: PLATFORM_TENANTS_UNKNOWN };
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
      return { kind: 'unknown', message: PLATFORM_TENANTS_UNKNOWN };
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
        'Chỉ Operator MFA (ticket-platform-api) — Owner/staff token bị từ chối.',
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: PLATFORM_TENANTS_UNKNOWN };
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

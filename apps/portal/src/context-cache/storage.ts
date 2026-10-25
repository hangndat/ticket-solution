import type { PortalContextCache } from './types';
import { PORTAL_CONTEXT_CACHE_VERSION } from './types';

export const PORTAL_CONTEXT_STORAGE_PREFIX = 'portal:context:v1';

export type StorageLike = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

export function portalContextStorageKey(userId: string): string {
  return `${PORTAL_CONTEXT_STORAGE_PREFIX}:${userId.trim()}`;
}

function emptyCache(): PortalContextCache {
  return {
    version: PORTAL_CONTEXT_CACHE_VERSION,
    tenantId: null,
    eventByTenant: {},
    portalUsedTenants: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePortalContextCache(raw: unknown): PortalContextCache {
  if (!isRecord(raw)) return emptyCache();
  if (raw.version !== PORTAL_CONTEXT_CACHE_VERSION) return emptyCache();

  const tenantId =
    raw.tenantId === null ? null : parseUuid(raw.tenantId) ?? null;

  const eventByTenant: Record<string, string | null> = {};
  if (isRecord(raw.eventByTenant)) {
    for (const [key, value] of Object.entries(raw.eventByTenant)) {
      const tenantKey = key.trim();
      if (!tenantKey) continue;
      if (value === null) {
        eventByTenant[tenantKey] = null;
        continue;
      }
      const eventId = parseUuid(value);
      if (eventId) eventByTenant[tenantKey] = eventId;
    }
  }

  const portalUsedTenants: string[] = [];
  if (Array.isArray(raw.portalUsedTenants)) {
    for (const item of raw.portalUsedTenants) {
      const id = parseUuid(item);
      if (id && !portalUsedTenants.includes(id)) {
        portalUsedTenants.push(id);
      }
    }
  }

  return {
    version: PORTAL_CONTEXT_CACHE_VERSION,
    tenantId,
    eventByTenant,
    portalUsedTenants,
  };
}

export function readPortalContextCache(
  userId: string,
  storage?: StorageLike | null,
): PortalContextCache {
  const backend = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!backend || !userId.trim()) return emptyCache();
  try {
    const raw = backend.getItem(portalContextStorageKey(userId));
    if (!raw) return emptyCache();
    return parsePortalContextCache(JSON.parse(raw) as unknown);
  } catch {
    return emptyCache();
  }
}

export function writePortalContextCache(
  userId: string,
  next: PortalContextCache,
  storage?: StorageLike | null,
): void {
  const backend = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!backend || !userId.trim()) return;
  try {
    backend.setItem(
      portalContextStorageKey(userId),
      JSON.stringify({
        version: PORTAL_CONTEXT_CACHE_VERSION,
        tenantId: next.tenantId,
        eventByTenant: next.eventByTenant,
        portalUsedTenants: next.portalUsedTenants,
      } satisfies PortalContextCache),
    );
  } catch {
    /* quota / private mode */
  }
}

export function patchPortalContextCache(
  userId: string,
  patch: (current: PortalContextCache) => PortalContextCache,
  storage?: StorageLike | null,
): PortalContextCache {
  const current = readPortalContextCache(userId, storage);
  const next = patch(current);
  writePortalContextCache(userId, next, storage);
  return next;
}

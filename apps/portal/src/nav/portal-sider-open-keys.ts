import { PORTAL_NAV_GROUP_KEYS } from './portal-menu-keys';

export const PORTAL_SIDER_OPEN_KEYS_STORAGE = 'vemoki.portal.siderOpenKeys';

const VALID_GROUP_KEYS = new Set<string>(PORTAL_NAV_GROUP_KEYS);

function sanitizeOpenKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (!VALID_GROUP_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Read user-persisted submenu open keys (session). */
export function readPersistedSiderOpenKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PORTAL_SIDER_OPEN_KEYS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitizeOpenKeys(parsed.filter((k): k is string => typeof k === 'string'));
  } catch {
    return [];
  }
}

export function writePersistedSiderOpenKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      PORTAL_SIDER_OPEN_KEYS_STORAGE,
      JSON.stringify(sanitizeOpenKeys(keys)),
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * Route-required groups stay open; user toggles persist across navigations.
 * Order follows PORTAL_NAV_GROUP_KEYS for stable DOM / no animation replay.
 */
export function mergePortalSiderOpenKeys(
  pathOpenKeys: string[],
  persistedKeys: string[],
): string[] {
  const set = new Set(sanitizeOpenKeys(persistedKeys));
  for (const key of sanitizeOpenKeys(pathOpenKeys)) set.add(key);
  return PORTAL_NAV_GROUP_KEYS.filter((k) => set.has(k));
}

import type { TenantBrandingDto } from './types.ts';
import { parseTenantBranding } from './parse.ts';

const KEY_PREFIX = 'ticket.tenant-branding.v1:';

export type BrandingCacheStore = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  clear: (key: string) => Promise<void>;
};

/** In-memory store for unit tests / SSR-safe paths. */
export function createMemoryBrandingCacheStore(): BrandingCacheStore {
  const map = new Map<string, string>();
  return {
    async read(key) {
      return map.get(key) ?? null;
    },
    async write(key, value) {
      map.set(key, value);
    },
    async clear(key) {
      map.delete(key);
    },
  };
}

let secureStorePromise: Promise<BrandingCacheStore> | null = null;

/**
 * SecureStore-backed cache (native). Lazy import so node tests never load Expo.
 * Failures resolve to no-op store — missing cache must not crash theme boot.
 */
async function getSecureBrandingCacheStore(): Promise<BrandingCacheStore> {
  if (!secureStorePromise) {
    secureStorePromise = (async () => {
      try {
        const SecureStore = await import('expo-secure-store');
        const options = {
          keychainService: 'ticket-foundation.tenant-branding',
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        };
        return {
          async read(key) {
            try {
              return await SecureStore.getItemAsync(key, options);
            } catch {
              return null;
            }
          },
          async write(key, value) {
            try {
              await SecureStore.setItemAsync(key, value, options);
            } catch {
              /* best-effort cache */
            }
          },
          async clear(key) {
            try {
              await SecureStore.deleteItemAsync(key, options);
            } catch {
              /* best-effort */
            }
          },
        };
      } catch {
        return createMemoryBrandingCacheStore();
      }
    })();
  }
  return secureStorePromise;
}

function storageKey(cacheKey: string): string {
  return `${KEY_PREFIX}${cacheKey.trim()}`;
}

export async function readCachedBranding(
  cacheKey: string,
  store?: BrandingCacheStore,
): Promise<TenantBrandingDto | null> {
  const key = cacheKey.trim();
  if (!key) return null;
  const backend = store ?? (await getSecureBrandingCacheStore());
  try {
    const raw = await backend.read(storageKey(key));
    if (!raw) return null;
    return parseTenantBranding(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function writeCachedBranding(
  branding: TenantBrandingDto,
  store?: BrandingCacheStore,
  cacheKey?: string,
): Promise<void> {
  const key =
    cacheKey?.trim() ||
    (branding.tenantId ? `id:${branding.tenantId}` : '') ||
    (branding.tenantSlug ? `slug:${branding.tenantSlug}` : '');
  if (!key) return;
  const backend = store ?? (await getSecureBrandingCacheStore());
  try {
    await backend.write(storageKey(key), JSON.stringify(branding));
  } catch {
    /* never throw from cache write */
  }
}

export async function clearCachedBranding(
  cacheKey: string,
  store?: BrandingCacheStore,
): Promise<void> {
  const key = cacheKey.trim();
  if (!key) return;
  const backend = store ?? (await getSecureBrandingCacheStore());
  try {
    await backend.clear(storageKey(key));
  } catch {
    /* never throw */
  }
}

/**
 * In-memory map of logo URLs that failed to load this session.
 * Prevents retry loops; does not persist (remote may recover later).
 */
const failedLogoUrls = new Set<string>();

export function markLogoUrlFailed(url: string): void {
  const trimmed = url.trim();
  if (trimmed) failedLogoUrls.add(trimmed);
}

export function isLogoUrlFailed(url: string | null | undefined): boolean {
  if (!url) return true;
  return failedLogoUrls.has(url.trim());
}

export function resetFailedLogoUrlsForTests(): void {
  failedLogoUrls.clear();
}

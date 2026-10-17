import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { getTenantId, getTenantSlug } from '@/identity/config';
import { session } from '@/identity/session';
import { fetchTenantBranding } from './branding-api.ts';
import {
  readCachedBranding,
  writeCachedBranding,
} from './branding-cache.ts';
import { defaultThemeTokens, resolveThemeTokens } from './resolve.ts';
import type { TenantBrandingDto, ThemeTokens } from './types.ts';

type ThemeContextValue = {
  theme: ThemeTokens;
  /** true while network refresh is in flight (cache may already show). */
  loading: boolean;
  refresh: () => Promise<void>;
  /** Apply a known branding payload (e.g. published event brand) without refetch. */
  applyBranding: (
    branding: TenantBrandingDto | null,
    source?: 'api' | 'cache',
  ) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function cacheKey(tenantId: string | null, tenantSlug: string | null): string | null {
  const id = tenantId?.trim() || '';
  const slug = tenantSlug?.trim() || '';
  if (id) return `id:${id}`;
  if (slug) return `slug:${slug}`;
  return null;
}

export function ThemeProvider({
  children,
  tenantId: tenantIdProp,
  tenantSlug: tenantSlugProp,
  fetchImpl,
  getBearer,
}: PropsWithChildren<{
  tenantId?: string | null;
  tenantSlug?: string | null;
  fetchImpl?: typeof fetch;
  getBearer?: () => Promise<string | null>;
}>) {
  const resolvedId = (tenantIdProp ?? getTenantId() ?? '').trim() || null;
  const resolvedSlug = (tenantSlugProp ?? getTenantSlug() ?? '').trim() || null;
  const [theme, setTheme] = useState<ThemeTokens>(() => defaultThemeTokens());
  const [loading, setLoading] = useState(false);

  const applyBranding = useCallback(
    (branding: TenantBrandingDto | null, source: 'api' | 'cache' = 'api') => {
      setTheme(resolveThemeTokens(branding, branding ? source : 'default'));
    },
    [],
  );

  const loadBranding = useCallback(
    async (opts: { signal?: { cancelled: boolean } } = {}) => {
      const cancelled = () => opts.signal?.cancelled === true;
      const key = cacheKey(resolvedId, resolvedSlug);
      if (!key) return;

      try {
        const cached = await readCachedBranding(key);
        if (cancelled()) return;
        if (cached) {
          setTheme(resolveThemeTokens(cached, 'cache'));
        }
        setLoading(true);

        const bearer =
          (await (getBearer
            ? getBearer()
            : session.getCredential().catch(() => null))) ?? null;

        const result = await fetchTenantBranding({
          tenantId: resolvedId,
          tenantSlug: resolvedSlug,
          bearer,
          fetchImpl,
        });
        if (cancelled()) return;

        if (result.status === 'ok') {
          await writeCachedBranding(result.branding, undefined, key);
          if (cancelled()) return;
          setTheme(resolveThemeTokens(result.branding, 'api'));
          return;
        }

        if (!cached) {
          setTheme(defaultThemeTokens());
        }
      } catch {
        if (!cancelled()) {
          setTheme((prev) =>
            prev.source === 'default' ? defaultThemeTokens() : prev,
          );
        }
      } finally {
        if (!cancelled()) setLoading(false);
      }
    },
    [resolvedId, resolvedSlug, fetchImpl, getBearer],
  );

  const refresh = useCallback(async () => {
    await loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    const signal = { cancelled: false };
    const handle = setTimeout(() => {
      void loadBranding({ signal });
    }, 0);
    return () => {
      signal.cancelled = true;
      clearTimeout(handle);
    };
  }, [loadBranding]);

  const value = useMemo(
    () => ({ theme, loading, refresh, applyBranding }),
    [theme, loading, refresh, applyBranding],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: defaultThemeTokens(),
      loading: false,
      refresh: async () => {},
      applyBranding: () => {},
    };
  }
  return ctx;
}

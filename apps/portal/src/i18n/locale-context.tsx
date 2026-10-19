'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_PORTAL_LOCALE,
  type PortalLocale,
} from './locale';
import {
  readStoredPortalLocale,
  writeStoredPortalLocale,
} from './storage';
import { t, type MessageKey, type TranslateVars } from './t';

type LocaleContextValue = {
  locale: PortalLocale;
  setLocale: (next: PortalLocale) => void;
  t: (key: MessageKey | string, vars?: TranslateVars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function PortalLocaleProvider({
  children,
  initialLocale = DEFAULT_PORTAL_LOCALE,
}: {
  children: ReactNode;
  /** Must match `readPortalLocaleFromServerCookies()` on the server. */
  initialLocale?: PortalLocale;
}) {
  const [locale, setLocaleState] = useState<PortalLocale>(initialLocale);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredPortalLocale();
    if (stored !== initialLocale) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
    }
    setHydrated(true);
  }, [initialLocale]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale;
  }, [locale, hydrated]);

  const setLocale = useCallback((next: PortalLocale) => {
    setLocaleState(next);
    writeStoredPortalLocale(next);
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => t(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function usePortalLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('usePortalLocale must be used within PortalLocaleProvider');
  }
  return ctx;
}

/** Optional: components outside provider (tests) fall back to VI. */
export function usePortalLocaleOptional(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_PORTAL_LOCALE,
    setLocale: () => undefined,
    t: (key, vars) => t(DEFAULT_PORTAL_LOCALE, key, vars),
  };
}

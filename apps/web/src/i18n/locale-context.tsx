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
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from './locale';
import {
  readStoredAttendeeLocale,
  writeStoredAttendeeLocale,
} from './storage';
import { t, type MessageKey } from './t';

type LocaleContextValue = {
  locale: AttendeeLocale;
  setLocale: (next: AttendeeLocale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyHtmlLang(locale: AttendeeLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.setAttribute('lang', locale);
}

export function AttendeeLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AttendeeLocale>(
    DEFAULT_ATTENDEE_LOCALE,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredAttendeeLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(stored);
    applyHtmlLang(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyHtmlLang(locale);
  }, [locale, hydrated]);

  const setLocale = useCallback((next: AttendeeLocale) => {
    setLocaleState(next);
    writeStoredAttendeeLocale(next);
    applyHtmlLang(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => t(locale, key),
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useAttendeeLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useAttendeeLocale must be used within AttendeeLocaleProvider');
  }
  return ctx;
}

export function useAttendeeLocaleOptional(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_ATTENDEE_LOCALE,
    setLocale: () => undefined,
    t: (key) => t(DEFAULT_ATTENDEE_LOCALE, key),
  };
}

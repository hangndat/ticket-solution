import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from './locale';

export type DualString = { readonly vi: string; readonly en: string };

export function dual(vi: string, en: string): DualString {
  return { vi, en };
}

export function isDualString(value: unknown): value is DualString {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.vi === 'string' &&
    typeof rec.en === 'string' &&
    Object.keys(rec).length === 2
  );
}

export function pickDual(
  value: DualString,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): string {
  return locale === 'en' ? value.en : value.vi;
}

export function formatDual(
  value: DualString,
  locale: AttendeeLocale,
  vars: Record<string, string>,
): string {
  return pickDual(value, locale).replace(/\{(\w+)\}/g, (_, key: string) => {
    return vars[key] ?? '';
  });
}

export type Localized<T> = T extends DualString
  ? string
  : T extends ReadonlyArray<infer U>
    ? { readonly [K in keyof T]: Localized<U> }
    : T extends object
      ? { readonly [K in keyof T]: Localized<T[K]> }
      : T;

export function localizeCatalog<T>(
  catalog: T,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): Localized<T> {
  if (isDualString(catalog)) return pickDual(catalog, locale) as Localized<T>;
  if (Array.isArray(catalog)) {
    return catalog.map((item) => localizeCatalog(item, locale)) as Localized<T>;
  }
  if (catalog && typeof catalog === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      catalog as Record<string, unknown>,
    )) {
      out[key] = localizeCatalog(value, locale);
    }
    return out as Localized<T>;
  }
  return catalog as Localized<T>;
}

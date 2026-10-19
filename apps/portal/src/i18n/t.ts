import { DICTS, VI, type MessageKey } from './messages';
import {
  DEFAULT_PORTAL_LOCALE,
  type PortalLocale,
} from './locale';

export type { MessageKey };

export type TranslateVars = Record<string, string | number | boolean | null | undefined>;

const missingKeys = new Set<string>();

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

/**
 * Translate a catalog key.
 * Missing EN → clear VI fallback (never blank / raw key for staff).
 * Unknown key → `[VI] <key>` + dev log (AC-C2 / PD missing-key).
 */
export function t(
  locale: PortalLocale,
  key: MessageKey | string,
  vars?: TranslateVars,
): string {
  const dict = DICTS[locale] ?? DICTS[DEFAULT_PORTAL_LOCALE];
  const viDict = VI as Record<string, string>;
  const primary = (dict as Record<string, string>)[key];
  if (typeof primary === 'string' && primary.length > 0) {
    return interpolate(primary, vars);
  }
  const fallback = viDict[key];
  if (typeof fallback === 'string' && fallback.length > 0) {
    if (
      locale === 'en' &&
      typeof process !== 'undefined' &&
      process.env.NODE_ENV !== 'production' &&
      !missingKeys.has(key)
    ) {
      missingKeys.add(key);
      console.warn(`[portal-i18n] missing EN key, fallback VI: ${key}`);
    }
    return interpolate(fallback, vars);
  }
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production' &&
    !missingKeys.has(`unknown:${key}`)
  ) {
    missingKeys.add(`unknown:${key}`);
    console.warn(`[portal-i18n] unknown key: ${key}`);
  }
  return `[VI] ${key}`;
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(VI, key);
}

import {
  MARKETING_ANALYTICS_CLIENT_EVENTS,
  PII_PROP_KEYS,
  type MarketingAnalyticsEventName,
  type MarketingAnalyticsProps,
} from './events';

const MAX_PROP_KEYS = 12;
const MAX_STRING_LEN = 64;

const LOCALES = new Set(['vi', 'en']);
const CTA_IDS = new Set(['cta-demo', 'cta-interest']);
const PII_VALUE_PATTERNS = [
  /@[^\s@]+\.[^\s@]+/,
  /\+?\d[\d\s().-]{7,}\d/,
  /https?:\/\//i,
  /\bwww\./i,
];

export type ValidateAnalyticsResult =
  | { ok: true; event: MarketingAnalyticsEventName; props: MarketingAnalyticsProps }
  | {
      ok: false;
      code: 'INVALID_EVENT' | 'INVALID_BODY' | 'PII' | 'PROP_SHAPE';
    };

function isAllowedClientEvent(
  value: unknown,
): value is MarketingAnalyticsEventName {
  return (
    typeof value === 'string' &&
    (MARKETING_ANALYTICS_CLIENT_EVENTS as readonly string[]).includes(value)
  );
}

function stringProp(
  raw: unknown,
  allow: Set<string>,
): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_STRING_LEN) return null;
  if (!allow.has(trimmed)) return null;
  if (PII_VALUE_PATTERNS.some((re) => re.test(trimmed))) return null;
  return trimmed;
}

function rejectFreeformString(value: string): boolean {
  return PII_VALUE_PATTERNS.some((re) => re.test(value));
}

function propsForEvent(
  event: MarketingAnalyticsEventName,
  raw: unknown,
): MarketingAnalyticsProps | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length > MAX_PROP_KEYS) return null;

  for (const key of keys) {
    if (PII_PROP_KEYS.has(key) || key.toLowerCase().includes('email')) {
      return null;
    }
  }

  const out: MarketingAnalyticsProps = {};

  switch (event) {
    case 'cta_click': {
      if (keys.length !== 2 || !keys.includes('cta_id') || !keys.includes('locale')) {
        return null;
      }
      const cta_id = stringProp(input.cta_id, CTA_IDS);
      const locale = stringProp(input.locale, LOCALES);
      if (!cta_id || !locale) return null;
      out.cta_id = cta_id;
      out.locale = locale;
      return out;
    }
    case 'form_start': {
      if (keys.length !== 1 || !keys.includes('locale')) return null;
      const locale = stringProp(input.locale, LOCALES);
      if (!locale) return null;
      out.locale = locale;
      return out;
    }
    default:
      return null;
  }
}

export function validateMarketingAnalyticsBody(
  body: unknown,
): ValidateAnalyticsResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_BODY' };
  }
  const record = body as Record<string, unknown>;
  if (!isAllowedClientEvent(record.event)) {
    return { ok: false, code: 'INVALID_EVENT' };
  }

  const rawProps = record.props ?? {};
  if (rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)) {
    for (const [key, value] of Object.entries(
      rawProps as Record<string, unknown>,
    )) {
      if (PII_PROP_KEYS.has(key) || key.toLowerCase().includes('email')) {
        return { ok: false, code: 'PII' };
      }
      if (typeof value === 'string' && rejectFreeformString(value.trim())) {
        return { ok: false, code: 'PII' };
      }
    }
  }

  const props = propsForEvent(record.event, record.props ?? {});
  if (props === null) {
    return { ok: false, code: 'PROP_SHAPE' };
  }

  return { ok: true, event: record.event, props };
}

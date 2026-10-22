import {
  MARKETING_ANALYTICS_EVENTS,
  PII_PROP_KEYS,
  type MarketingAnalyticsEventName,
  type MarketingAnalyticsProps,
} from './events';

const MAX_PROP_KEYS = 12;
const MAX_STRING_LEN = 64;

export type ValidateAnalyticsResult =
  | { ok: true; event: MarketingAnalyticsEventName; props: MarketingAnalyticsProps }
  | { ok: false; code: 'INVALID_EVENT' | 'INVALID_BODY' | 'PII' | 'PROP_SHAPE' };

function isAllowedEvent(value: unknown): value is MarketingAnalyticsEventName {
  return (
    typeof value === 'string' &&
    (MARKETING_ANALYTICS_EVENTS as readonly string[]).includes(value)
  );
}

function sanitizeProps(raw: unknown): MarketingAnalyticsProps | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length > MAX_PROP_KEYS) return null;

  const out: MarketingAnalyticsProps = {};
  for (const key of keys) {
    if (PII_PROP_KEYS.has(key) || key.toLowerCase().includes('email')) {
      return null;
    }
    const v = input[key];
    if (v === null) {
      out[key] = null;
      continue;
    }
    if (typeof v === 'boolean' || typeof v === 'number') {
      out[key] = v;
      continue;
    }
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed || trimmed.length > MAX_STRING_LEN) return null;
      out[key] = trimmed;
      continue;
    }
    return null;
  }
  return out;
}

export function validateMarketingAnalyticsBody(
  body: unknown,
): ValidateAnalyticsResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_BODY' };
  }
  const record = body as Record<string, unknown>;
  if (!isAllowedEvent(record.event)) {
    return { ok: false, code: 'INVALID_EVENT' };
  }
  const rawProps = record.props ?? {};
  if (rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)) {
    for (const key of Object.keys(rawProps as Record<string, unknown>)) {
      if (PII_PROP_KEYS.has(key) || key.toLowerCase().includes('email')) {
        return { ok: false, code: 'PII' };
      }
    }
  }
  const props = sanitizeProps(record.props ?? {});
  if (props === null) {
    return { ok: false, code: 'PROP_SHAPE' };
  }
  for (const key of Object.keys(props)) {
    if (PII_PROP_KEYS.has(key)) {
      return { ok: false, code: 'PII' };
    }
  }
  return { ok: true, event: record.event, props };
}

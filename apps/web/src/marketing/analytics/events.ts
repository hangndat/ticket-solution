export const MARKETING_ANALYTICS_EVENTS = [
  'cta_click',
  'form_start',
  'lead_submitted',
  'qualified_lead',
] as const;

export type MarketingAnalyticsEventName =
  (typeof MARKETING_ANALYTICS_EVENTS)[number];

/** Keys that must never appear in analytics payloads (PII). */
export const PII_PROP_KEYS = new Set([
  'email',
  'name',
  'phone',
  'ip',
  'address',
  'note',
  'org',
  'user',
  'userId',
  'session',
  'token',
]);

export type MarketingAnalyticsProps = Record<
  string,
  string | number | boolean | null
>;

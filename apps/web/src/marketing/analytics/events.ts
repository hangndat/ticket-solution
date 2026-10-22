/** Events accepted from the browser via POST /api/marketing/events */
export const MARKETING_ANALYTICS_CLIENT_EVENTS = [
  'cta_click',
  'form_start',
] as const;

/** Includes server-emitted funnel events (lead_submitted, qualified_lead). */
export const MARKETING_ANALYTICS_EVENTS = [
  ...MARKETING_ANALYTICS_CLIENT_EVENTS,
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

/** Events accepted from the browser via POST /api/marketing/events */
export const MARKETING_ANALYTICS_CLIENT_EVENTS = [
  'cta_click',
  'form_start',
  'journey_progress',
] as const;

export const JOURNEY_MILESTONES = ['invitation', 'arrival', 'gateway', 'moment', 'complete'] as const;
export type JourneyMilestone = (typeof JOURNEY_MILESTONES)[number];

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

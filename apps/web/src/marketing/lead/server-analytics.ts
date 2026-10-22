import { trackMarketingEvent } from '../analytics/track';
import type { LeadRecord } from './types';

/** Server-only funnel events — no PII in props. */
export function emitLeadAnalytics(
  record: LeadRecord,
  webhook_notified: boolean,
  opts?: { skip?: boolean },
) {
  if (opts?.skip) return;

  trackMarketingEvent('lead_submitted', {
    locale: record.locale,
    lead_id: record.lead_id,
    role: record.payload.role,
    qualified: record.qualified,
    webhook_notified,
  });

  if (record.qualified) {
    trackMarketingEvent('qualified_lead', {
      locale: record.locale,
      lead_id: record.lead_id,
      score: record.score,
      tier: record.tier,
      signals: record.signals.join(','),
    });
  }
}

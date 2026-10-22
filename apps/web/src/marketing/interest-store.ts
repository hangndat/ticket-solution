import { acceptMarketingLead } from './lead/accept-lead';
import {
  appendInterestRecord,
  resolveInterestPath,
} from './lead/adapters/jsonl-adapter';
import type { LeadRecord } from './lead/types';
import type { InterestPayload } from './interest-validate';
import type { MarketingLeadLocale } from './interest-schema';

export type InterestRecord = LeadRecord;

export { resolveInterestPath, appendInterestRecord };

/**
 * @deprecated Prefer acceptMarketingLead — kept for tests and legacy imports.
 */
export async function notifyInterestWebhook(): Promise<{
  notified: boolean;
  status?: number;
  error?: string;
}> {
  return { notified: false };
}

export async function persistInterestSubmission(
  value: InterestPayload,
  opts?: { clientKey?: string; locale?: MarketingLeadLocale },
): Promise<InterestRecord> {
  const result = await acceptMarketingLead(value, {
    clientKey: opts?.clientKey,
    locale: opts?.locale,
  });
  if (!result.ok) {
    throw new Error('STORE_FAILED');
  }
  return result.record;
}

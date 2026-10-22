import type { InterestPayload } from '../interest-schema';
import type { LeadTier } from './types';

const INTENT_RE =
  /gate|multi[- ]?event|white[- ]?label|cổng|agency|enterprise|whitelabel/i;

export type QualifiedScore = {
  score: number;
  tier: LeadTier;
  qualified: boolean;
  signals: string[];
};

export function scoreQualifiedLead(payload: InterestPayload): QualifiedScore {
  const signals: string[] = [];
  let score = 0;

  if (payload.role === 'agency') {
    score += 35;
    signals.push('role_agency');
  } else if (payload.role === 'owner') {
    score += 25;
    signals.push('role_owner');
  }

  if (
    payload.org_kind === 'agency' ||
    payload.org_kind === 'brand_enterprise'
  ) {
    score += 20;
    signals.push('org_kind_icp');
  }

  if (payload.events_per_year === '6-20' || payload.events_per_year === '21+') {
    score += 15;
    signals.push('events_high');
  }

  if (
    payload.typical_scale === '500_2000' ||
    payload.typical_scale === '2000_10000' ||
    payload.typical_scale === 'over_10000'
  ) {
    score += 10;
    signals.push('scale_mid_plus');
  }

  if (payload.note && INTENT_RE.test(payload.note)) {
    score += 15;
    signals.push('note_intent');
  }

  const qualified = score >= 60;
  let tier: LeadTier = 'C';
  if (score >= 80) tier = 'A';
  else if (score >= 60) tier = 'B';

  return { score, tier, qualified, signals };
}

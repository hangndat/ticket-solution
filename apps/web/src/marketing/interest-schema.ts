import { z } from 'zod';

export const INTEREST_ROLES = ['owner', 'agency', 'other'] as const;
export type InterestRole = (typeof INTEREST_ROLES)[number];

export const ORG_KINDS = [
  'agency',
  'brand_enterprise',
  'venue',
  'independent',
  'other',
] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const EVENTS_PER_YEAR = ['0', '1-5', '6-20', '21+'] as const;
export type EventsPerYear = (typeof EVENTS_PER_YEAR)[number];

export const TYPICAL_SCALES = [
  'under_500',
  '500_2000',
  '2000_10000',
  'over_10000',
] as const;
export type TypicalScale = (typeof TYPICAL_SCALES)[number];

export const MARKETING_LOCALES = ['vi', 'en'] as const;
export type MarketingLeadLocale = (typeof MARKETING_LOCALES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function emptyToUndefined(v: unknown): unknown {
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
}

function consentCoerce(v: unknown): boolean {
  return (
    v === true ||
    v === 'true' ||
    v === 'on' ||
    v === '1'
  );
}

/** Shared wire shape for interest POST (client + server). */
export const interestPayloadSchema = z.object({
  name: z.preprocess(trimString, z.string().min(1)),
  email: z.preprocess(trimString, z.string().min(1)),
  org: z.preprocess(trimString, z.string().min(1)),
  role: z.enum(INTEREST_ROLES),
  note: z.preprocess(trimString, z.string()).default(''),
  consent: z.preprocess(consentCoerce, z.literal(true)),
  org_kind: z.preprocess(emptyToUndefined, z.enum(ORG_KINDS).optional()),
  events_per_year: z.preprocess(
    emptyToUndefined,
    z.enum(EVENTS_PER_YEAR).optional(),
  ),
  typical_scale: z.preprocess(
    emptyToUndefined,
    z.enum(TYPICAL_SCALES).optional(),
  ),
  locale: z.enum(MARKETING_LOCALES).optional(),
  client_submit_id: z.preprocess(trimString, z.string()).optional(),
});

export type InterestPayload = z.infer<typeof interestPayloadSchema>;

export type InterestInput = {
  name?: unknown;
  email?: unknown;
  org?: unknown;
  role?: unknown;
  note?: unknown;
  consent?: unknown;
  website?: unknown;
  org_kind?: unknown;
  events_per_year?: unknown;
  typical_scale?: unknown;
  locale?: unknown;
  client_submit_id?: unknown;
};

export function isValidInterestEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

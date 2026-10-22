import { z } from 'zod';
import {
  EVENTS_PER_YEAR,
  INTEREST_ROLES,
  MARKETING_LOCALES,
  ORG_KINDS,
  TYPICAL_SCALES,
  type InterestInput,
  type InterestPayload,
} from './interest-fields';

export {
  EVENTS_PER_YEAR,
  INTEREST_ROLES,
  MARKETING_LOCALES,
  ORG_KINDS,
  TYPICAL_SCALES,
  type EventsPerYear,
  type InterestInput,
  type InterestPayload,
  type InterestRole,
  type MarketingLeadLocale,
  type OrgKind,
  type TypicalScale,
} from './interest-fields';

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

/** Server wire parse — shared shape with client manual builder. */
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

export function parseInterestPayload(input: InterestInput): InterestPayload {
  return interestPayloadSchema.parse(input);
}

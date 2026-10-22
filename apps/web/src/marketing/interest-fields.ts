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

export type InterestPayload = {
  name: string;
  email: string;
  org: string;
  role: InterestRole;
  note: string;
  consent: true;
  org_kind?: OrgKind;
  events_per_year?: EventsPerYear;
  typical_scale?: TypicalScale;
  locale?: MarketingLeadLocale;
  client_submit_id?: string;
};

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

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function consentCoerce(v: unknown): boolean {
  return (
    v === true ||
    v === 'true' ||
    v === 'on' ||
    v === '1'
  );
}

function isOrgKind(v: string): v is OrgKind {
  return (ORG_KINDS as readonly string[]).includes(v);
}

function isEventsPerYear(v: string): v is EventsPerYear {
  return (EVENTS_PER_YEAR as readonly string[]).includes(v);
}

function isTypicalScale(v: string): v is TypicalScale {
  return (TYPICAL_SCALES as readonly string[]).includes(v);
}

function isMarketingLocale(v: string): v is MarketingLeadLocale {
  return (MARKETING_LOCALES as readonly string[]).includes(v);
}

export type InterestFieldError =
  | 'name'
  | 'email'
  | 'emailInvalid'
  | 'org'
  | 'role'
  | 'consent';

/** Client-safe validation — no zod dependency. */
export function collectInterestFieldErrors(
  input: InterestInput,
): InterestFieldError[] | null {
  const fields: InterestFieldError[] = [];
  const name = asString(input.name);
  const email = asString(input.email);
  const org = asString(input.org);
  const roleRaw = asString(input.role);
  const consent = consentCoerce(input.consent);

  if (!name) fields.push('name');
  if (!email) fields.push('email');
  else if (!isValidInterestEmail(email)) fields.push('emailInvalid');
  if (!org) fields.push('org');
  if (roleRaw !== 'owner' && roleRaw !== 'agency' && roleRaw !== 'other') {
    fields.push('role');
  }
  if (!consent) fields.push('consent');

  return fields.length > 0 ? fields : null;
}

export function buildInterestPayload(input: InterestInput): InterestPayload {
  const name = asString(input.name);
  const email = asString(input.email);
  const org = asString(input.org);
  const role = asString(input.role) as InterestRole;
  const note = asString(input.note);
  const orgKindRaw = asString(input.org_kind);
  const eventsRaw = asString(input.events_per_year);
  const scaleRaw = asString(input.typical_scale);
  const localeRaw = asString(input.locale);
  const clientSubmitId = asString(input.client_submit_id);

  const payload: InterestPayload = {
    name,
    email,
    org,
    role,
    note,
    consent: true,
  };

  if (orgKindRaw && isOrgKind(orgKindRaw)) payload.org_kind = orgKindRaw;
  if (eventsRaw && isEventsPerYear(eventsRaw)) {
    payload.events_per_year = eventsRaw;
  }
  if (scaleRaw && isTypicalScale(scaleRaw)) payload.typical_scale = scaleRaw;
  if (localeRaw && isMarketingLocale(localeRaw)) payload.locale = localeRaw;
  if (clientSubmitId) payload.client_submit_id = clientSubmitId;

  return payload;
}

import {
  interestPayloadSchema,
  isValidInterestEmail,
  type InterestInput,
  type InterestPayload,
} from './interest-schema';

export type { InterestPayload, InterestRole } from './interest-schema';

export type InterestFieldError =
  | 'name'
  | 'email'
  | 'emailInvalid'
  | 'org'
  | 'role'
  | 'consent';

export type InterestValidation =
  | { ok: true; value: InterestPayload }
  | { ok: false; fields: InterestFieldError[]; honeypot?: boolean };

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function fieldErrorsFromZod(
  input: InterestInput,
): InterestFieldError[] | null {
  const fields: InterestFieldError[] = [];
  const name = asString(input.name);
  const email = asString(input.email);
  const org = asString(input.org);
  const roleRaw = asString(input.role);
  const consent =
    input.consent === true ||
    input.consent === 'true' ||
    input.consent === 'on' ||
    input.consent === '1';

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

export function validateInterest(input: InterestInput): InterestValidation {
  if (asString(input.website)) {
    return { ok: false, fields: [], honeypot: true };
  }

  const manualErrors = fieldErrorsFromZod(input);
  if (manualErrors) {
    return { ok: false, fields: manualErrors };
  }

  const parsed = interestPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const manual = fieldErrorsFromZod(input);
    return { ok: false, fields: manual ?? ['name'] };
  }

  return { ok: true, value: parsed.data };
}

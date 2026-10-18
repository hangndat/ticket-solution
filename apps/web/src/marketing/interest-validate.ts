export type InterestRole = 'owner' | 'agency' | 'other';

export type InterestInput = {
  name?: unknown;
  email?: unknown;
  org?: unknown;
  role?: unknown;
  note?: unknown;
  consent?: unknown;
  /** Honeypot — must be empty */
  website?: unknown;
};

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

export type InterestPayload = {
  name: string;
  email: string;
  org: string;
  role: InterestRole;
  note: string;
  consent: true;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function validateInterest(input: InterestInput): InterestValidation {
  if (asString(input.website)) {
    return { ok: false, fields: [], honeypot: true };
  }

  const fields: InterestFieldError[] = [];
  const name = asString(input.name);
  const email = asString(input.email);
  const org = asString(input.org);
  const roleRaw = asString(input.role);
  const note = asString(input.note);
  const consent =
    input.consent === true ||
    input.consent === 'true' ||
    input.consent === 'on' ||
    input.consent === '1';

  if (!name) fields.push('name');
  if (!email) fields.push('email');
  else if (!EMAIL_RE.test(email)) fields.push('emailInvalid');
  if (!org) fields.push('org');
  if (roleRaw !== 'owner' && roleRaw !== 'agency' && roleRaw !== 'other') {
    fields.push('role');
  }
  if (!consent) fields.push('consent');

  if (fields.length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      org,
      role: roleRaw as InterestRole,
      note,
      consent: true,
    },
  };
}

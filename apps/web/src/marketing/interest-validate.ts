import {
  collectInterestFieldErrors,
  type InterestFieldError,
  type InterestInput,
  type InterestPayload,
} from './interest-fields';
import { interestPayloadSchema } from './interest-schema';

export type { InterestPayload, InterestRole } from './interest-fields';
export type { InterestFieldError };

export type InterestValidation =
  | { ok: true; value: InterestPayload }
  | { ok: false; fields: InterestFieldError[]; honeypot?: boolean };

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Server route validation — zod canonicalizes wire shape after manual field errors. */
export function validateInterest(input: InterestInput): InterestValidation {
  if (asString(input.website)) {
    return { ok: false, fields: [], honeypot: true };
  }

  const manualErrors = collectInterestFieldErrors(input);
  if (manualErrors) {
    return { ok: false, fields: manualErrors };
  }

  const parsed = interestPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const manual = collectInterestFieldErrors(input);
    return { ok: false, fields: manual ?? ['name'] };
  }

  return { ok: true, value: parsed.data };
}

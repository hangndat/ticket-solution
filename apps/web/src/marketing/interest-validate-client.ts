import {
  buildInterestPayload,
  collectInterestFieldErrors,
  type InterestFieldError,
  type InterestInput,
  type InterestPayload,
} from './interest-fields';

export type { InterestFieldError, InterestPayload, InterestRole } from './interest-fields';

export type InterestValidation =
  | { ok: true; value: InterestPayload }
  | { ok: false; fields: InterestFieldError[]; honeypot?: boolean };

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Browser-only — keep free of zod so the dynamic form chunk stays small. */
export function validateInterest(input: InterestInput): InterestValidation {
  if (asString(input.website)) {
    return { ok: false, fields: [], honeypot: true };
  }

  const manualErrors = collectInterestFieldErrors(input);
  if (manualErrors) {
    return { ok: false, fields: manualErrors };
  }

  return { ok: true, value: buildInterestPayload(input) };
}

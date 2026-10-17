/**
 * C-F server form/terms validators. API is the source of truth; clients may precheck.
 * Does not normalize phone by stripping country/prefix — trim only.
 */

import { createHash } from 'node:crypto';
import {
  FORM_LIMITS,
  type FormAnswerValue,
  type FormDefinition,
  type FormFieldDefinition,
  type FieldValidationError,
} from '@ticket/contracts';

export type FormValidateResult =
  | { ok: true; answers: Record<string, FormAnswerValue> }
  | { ok: false; fields: FieldValidationError[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Keep prefix; trim only — allow + digits spaces () . - */
const PHONE_RE = /^[+\d\s().-]{3,32}$/;

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

function validateField(
  field: FormFieldDefinition,
  raw: FormAnswerValue | undefined,
): FieldValidationError | null {
  if (field.type === 'checkbox') {
    if (raw === undefined || raw === null) {
      if (field.required) {
        return {
          fieldId: field.id,
          code: 'REQUIRED',
          message: `${field.label} is required.`,
        };
      }
      return null;
    }
    if (typeof raw !== 'boolean') {
      return {
        fieldId: field.id,
        code: 'INVALID_TYPE',
        message: `${field.label} must be true or false.`,
      };
    }
    if (field.required && raw !== true) {
      return {
        fieldId: field.id,
        code: 'REQUIRED',
        message: `${field.label} must be checked.`,
      };
    }
    return null;
  }

  const text = normalizeString(raw);
  if (text === null || text.length === 0) {
    if (field.required) {
      return {
        fieldId: field.id,
        code: 'REQUIRED',
        message: `${field.label} is required.`,
      };
    }
    return null;
  }

  if (field.type === 'text') {
    if (text.length > FORM_LIMITS.maxTextLength) {
      return {
        fieldId: field.id,
        code: 'TOO_LONG',
        message: `${field.label} is too long.`,
      };
    }
    return null;
  }

  if (field.type === 'email') {
    if (text.length > FORM_LIMITS.maxEmailLength || !EMAIL_RE.test(text)) {
      return {
        fieldId: field.id,
        code: 'INVALID_EMAIL',
        message: `${field.label} is not a valid email.`,
      };
    }
    return null;
  }

  if (field.type === 'phone') {
    if (
      text.length < FORM_LIMITS.phoneMinLength ||
      text.length > FORM_LIMITS.phoneMaxLength ||
      !PHONE_RE.test(text)
    ) {
      return {
        fieldId: field.id,
        code: 'INVALID_PHONE',
        message: `${field.label} is not a valid phone.`,
      };
    }
    return null;
  }

  if (field.type === 'select') {
    const options = field.options ?? [];
    if (!options.some((o) => o.id === text)) {
      return {
        fieldId: field.id,
        code: 'INVALID_OPTION',
        message: `${field.label} selection is not allowed.`,
      };
    }
    return null;
  }

  return {
    fieldId: field.id,
    code: 'UNKNOWN_TYPE',
    message: `${field.label} has an unsupported type.`,
  };
}

/**
 * Validate answers against a published form definition.
 * Rejects unknown keys; drops empty optional fields from the normalized map.
 */
export function validateFormAnswers(
  definition: FormDefinition | null | undefined,
  answers: Record<string, FormAnswerValue> | undefined,
): FormValidateResult {
  const input = answers ?? {};
  if (!definition || definition.fields.length === 0) {
    const keys = Object.keys(input);
    if (keys.length > 0) {
      return {
        ok: false,
        fields: keys.map((fieldId) => ({
          fieldId,
          code: 'UNKNOWN_FIELD',
          message: 'Unknown form field.',
        })),
      };
    }
    return { ok: true, answers: {} };
  }

  if (definition.fields.length > FORM_LIMITS.maxFields) {
    return {
      ok: false,
      fields: [
        {
          fieldId: '_form',
          code: 'TOO_MANY_FIELDS',
          message: 'Form definition exceeds field limit.',
        },
      ],
    };
  }

  const known = new Set(definition.fields.map((f) => f.id));
  const fields: FieldValidationError[] = [];
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      fields.push({
        fieldId: key,
        code: 'UNKNOWN_FIELD',
        message: 'Unknown form field.',
      });
    }
  }

  const normalized: Record<string, FormAnswerValue> = {};
  for (const field of definition.fields) {
    const issue = validateField(field, input[field.id]);
    if (issue) {
      fields.push(issue);
      continue;
    }
    const raw = input[field.id];
    if (field.type === 'checkbox') {
      if (typeof raw === 'boolean') normalized[field.id] = raw;
      continue;
    }
    const text = normalizeString(raw);
    if (text !== null && text.length > 0) normalized[field.id] = text;
  }

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, answers: normalized };
}

/** Stable hash of definition for immutable consent evidence (no PII). */
export function hashFormDefinition(definition: FormDefinition): string {
  const payload = JSON.stringify({
    formVersion: definition.formVersion,
    fields: definition.fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      options: (f.options ?? []).map((o) => ({ id: o.id, label: o.label })),
    })),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function hashTermsContent(input: {
  termsVersion: string;
  body: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        termsVersion: input.termsVersion,
        body: input.body,
      }),
    )
    .digest('hex');
}

/** Deterministic JSON for canonical request hash (sorted keys). */
export function canonicalizeAnswers(
  answers: Record<string, FormAnswerValue>,
): Record<string, FormAnswerValue> {
  const out: Record<string, FormAnswerValue> = {};
  for (const key of Object.keys(answers).sort()) {
    out[key] = answers[key]!;
  }
  return out;
}

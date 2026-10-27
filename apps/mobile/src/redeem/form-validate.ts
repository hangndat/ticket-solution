import {
  FORM_LIMITS,
  type FormAnswerValue,
  type FormDefinition,
  type FormFieldDefinition,
} from './contract.ts';

export type FieldValidationIssue = {
  fieldId: string;
  code: string;
  message: string;
};

export type FormValidateResult =
  | { ok: true; answers: Record<string, FormAnswerValue> }
  | { ok: false; issues: FieldValidationIssue[] };

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
): FieldValidationIssue | null {
  if (field.type === 'checkbox') {
    if (raw === undefined || raw === null) {
      if (field.required) {
        return {
          fieldId: field.id,
          code: 'REQUIRED',
          message: `${field.label} là bắt buộc.`,
        };
      }
      return null;
    }
    if (typeof raw !== 'boolean') {
      return {
        fieldId: field.id,
        code: 'INVALID_TYPE',
        message: `${field.label} phải là có hoặc không.`,
      };
    }
    if (field.required && raw !== true) {
      return {
        fieldId: field.id,
        code: 'REQUIRED',
        message: `${field.label} cần được chọn.`,
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
        message: `${field.label} là bắt buộc.`,
      };
    }
    return null;
  }

  if (field.type === 'text') {
    if (text.length > FORM_LIMITS.maxTextLength) {
      return {
        fieldId: field.id,
        code: 'TOO_LONG',
        message: `${field.label} quá dài.`,
      };
    }
    return null;
  }

  if (field.type === 'email') {
    if (text.length > FORM_LIMITS.maxEmailLength || !EMAIL_RE.test(text)) {
      return {
        fieldId: field.id,
        code: 'INVALID_EMAIL',
        message: `${field.label} không phải email hợp lệ.`,
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
        message: `${field.label} không phải số điện thoại hợp lệ.`,
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
        message: `${field.label} không nằm trong lựa chọn cho phép.`,
      };
    }
    return null;
  }

  return {
    fieldId: field.id,
    code: 'UNKNOWN_TYPE',
    message: `${field.label} có kiểu không hỗ trợ.`,
  };
}

/**
 * Client-side precheck — server remains source of truth.
 * Drops empty optional fields; rejects unknown keys.
 */
export function validateFormAnswers(
  definition: FormDefinition | null | undefined,
  answers: Record<string, FormAnswerValue>,
): FormValidateResult {
  if (!definition || definition.fields.length === 0) {
    const keys = Object.keys(answers);
    if (keys.length > 0) {
      return {
        ok: false,
        issues: keys.map((fieldId) => ({
          fieldId,
          code: 'UNKNOWN_FIELD',
          message: 'Trường biểu mẫu không hợp lệ.',
        })),
      };
    }
    return { ok: true, answers: {} };
  }

  const known = new Set(definition.fields.map((f) => f.id));
  const issues: FieldValidationIssue[] = [];
  for (const key of Object.keys(answers)) {
    if (!known.has(key)) {
      issues.push({
        fieldId: key,
        code: 'UNKNOWN_FIELD',
        message: 'Trường biểu mẫu không hợp lệ.',
      });
    }
  }

  const normalized: Record<string, FormAnswerValue> = {};
  for (const field of definition.fields) {
    const issue = validateField(field, answers[field.id]);
    if (issue) {
      issues.push(issue);
      continue;
    }
    const raw = answers[field.id];
    if (field.type === 'checkbox') {
      if (typeof raw === 'boolean') normalized[field.id] = raw;
      continue;
    }
    const text = normalizeString(raw);
    if (text !== null && text.length > 0) normalized[field.id] = text;
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, answers: normalized };
}

export function requireTermsConsent(input: {
  termsVersion: string | null | undefined;
  termsAccepted: boolean;
}): FieldValidationIssue | null {
  if (!input.termsVersion) return null;
  if (input.termsAccepted !== true) {
    return {
      fieldId: 'terms',
      code: 'TERMS_REQUIRED',
      message: 'Cần đồng ý điều khoản đã công bố.',
    };
  }
  return null;
}

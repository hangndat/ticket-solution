import type { FormDefinition, FormFieldType } from '@ticket/contracts';
import { isUuid } from '../bff/ids';

const FIELD_TYPES = new Set<FormFieldType>([
  'text',
  'email',
  'phone',
  'select',
  'checkbox',
]);

export type PublishedTerms = {
  version: string;
  bodyMarkdown: string;
};

/** Subset of public published event needed for redeem form/terms. */
export type PublishedRedeemSchema = {
  eventId: string;
  /** From public projection when API exposes tenant scope (D02). */
  tenantId?: string;
  form: FormDefinition | null;
  terms: PublishedTerms | null;
  schemaVersion: number;
  publishedConfigVersion: number;
};

export type LoadPublishedSchemaResult =
  | { status: 'ok'; schema: PublishedRedeemSchema }
  | { status: 'not-found' }
  | { status: 'unreachable' }
  | { status: 'invalid' }
  | { status: 'misconfigured' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isFormDefinition(value: unknown): value is FormDefinition {
  if (!isRecord(value)) return false;
  if (typeof value.formVersion !== 'string' || !value.formVersion) return false;
  if (!Array.isArray(value.fields)) return false;
  for (const field of value.fields) {
    if (!isRecord(field)) return false;
    if (typeof field.id !== 'string' || !field.id) return false;
    if (typeof field.label !== 'string') return false;
    if (typeof field.type !== 'string' || !FIELD_TYPES.has(field.type as FormFieldType)) {
      return false;
    }
    if (typeof field.required !== 'boolean') return false;
    if (field.options !== undefined) {
      if (!Array.isArray(field.options)) return false;
      for (const opt of field.options) {
        if (
          !isRecord(opt) ||
          typeof opt.id !== 'string' ||
          typeof opt.label !== 'string'
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

export function parsePublishedRedeemSchema(
  value: unknown,
): PublishedRedeemSchema | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !value.id) return null;
  if (typeof value.schemaVersion !== 'number') return null;
  if (typeof value.publishedConfigVersion !== 'number') return null;

  let form: FormDefinition | null = null;
  if (value.form !== undefined && value.form !== null) {
    if (!isFormDefinition(value.form)) return null;
    form = value.form;
  }

  let terms: PublishedTerms | null = null;
  if (value.terms !== null && value.terms !== undefined) {
    if (
      !isRecord(value.terms) ||
      typeof value.terms.version !== 'string' ||
      typeof value.terms.bodyMarkdown !== 'string'
    ) {
      return null;
    }
    terms = {
      version: value.terms.version,
      bodyMarkdown: value.terms.bodyMarkdown,
    };
  }

  let tenantId: string | undefined;
  if (value.tenantId !== undefined && value.tenantId !== null) {
    if (typeof value.tenantId !== 'string' || !isUuid(value.tenantId)) {
      return null;
    }
    tenantId = value.tenantId.trim();
  }

  return {
    eventId: value.id,
    tenantId,
    form,
    terms,
    schemaVersion: value.schemaVersion,
    publishedConfigVersion: value.publishedConfigVersion,
  };
}

/**
 * Load published form/terms via same-origin BFF.
 * Fail-closed — never invent a demo form as published.
 */
export async function loadPublishedRedeemSchema(
  tenantSlug: string,
  eventSlug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadPublishedSchemaResult> {
  const t = tenantSlug.trim();
  const e = eventSlug.trim();
  if (!t || !e) return { status: 'invalid' };

  try {
    const response = await fetchImpl(
      `/api/bff/public/tenants/${encodeURIComponent(t)}/events/${encodeURIComponent(e)}`,
      { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
    );
    if (response.status === 404) return { status: 'not-found' };
    if (response.status >= 500) return { status: 'unreachable' };
    if (!response.ok) return { status: 'invalid' };
    const json: unknown = await response.json();
    const schema = parsePublishedRedeemSchema(json);
    return schema ? { status: 'ok', schema } : { status: 'invalid' };
  } catch {
    return { status: 'unreachable' };
  }
}

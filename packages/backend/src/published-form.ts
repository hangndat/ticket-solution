/**
 * Resolve published form/terms from event_config_versions pointer.
 * Additive payload keys `form` / `formDefinition` carry FormDefinition.
 */

import type { Prisma } from './generated/prisma/client';
import type { FormDefinition } from '@ticket/contracts';
import { FORM_LIMITS } from '@ticket/contracts';

export type PublishedFormTerms = {
  form: FormDefinition | null;
  termsVersion: string | null;
  termsBody: string | null;
  publishedConfigVersion: number | null;
};

function asFormDefinition(value: unknown): FormDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as {
    formVersion?: unknown;
    fields?: unknown;
  };
  if (typeof body.formVersion !== 'string' || !Array.isArray(body.fields)) {
    return null;
  }
  if (body.fields.length > FORM_LIMITS.maxFields) return null;
  const fields: FormDefinition['fields'] = [];
  for (const raw of body.fields) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const f = raw as {
      id?: unknown;
      label?: unknown;
      type?: unknown;
      required?: unknown;
      options?: unknown;
    };
    if (
      typeof f.id !== 'string' ||
      f.id.length === 0 ||
      f.id.length > FORM_LIMITS.maxFieldIdLength ||
      typeof f.label !== 'string' ||
      f.label.length > FORM_LIMITS.maxLabelLength ||
      typeof f.type !== 'string' ||
      typeof f.required !== 'boolean'
    ) {
      return null;
    }
    if (
      f.type !== 'text' &&
      f.type !== 'email' &&
      f.type !== 'phone' &&
      f.type !== 'select' &&
      f.type !== 'checkbox'
    ) {
      return null;
    }
    let options: FormDefinition['fields'][number]['options'];
    if (f.type === 'select') {
      if (!Array.isArray(f.options) || f.options.length > FORM_LIMITS.maxSelectOptions) {
        return null;
      }
      options = [];
      for (const opt of f.options) {
        if (!opt || typeof opt !== 'object' || Array.isArray(opt)) return null;
        const o = opt as { id?: unknown; label?: unknown };
        if (typeof o.id !== 'string' || typeof o.label !== 'string') return null;
        options.push({ id: o.id, label: o.label });
      }
    }
    fields.push({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      options,
    });
  }
  return { formVersion: body.formVersion, fields };
}

function termsFromPayload(payload: Record<string, unknown>): {
  termsVersion: string | null;
  termsBody: string | null;
} {
  const topVersion =
    typeof payload.termsVersion === 'string' ? payload.termsVersion : null;
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  for (const section of sections) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    const s = section as {
      kind?: unknown;
      body?: unknown;
    };
    if (s.kind !== 'terms') continue;
    const body =
      s.body && typeof s.body === 'object' && !Array.isArray(s.body)
        ? (s.body as Record<string, unknown>)
        : {};
    const version =
      typeof body.termsVersion === 'string'
        ? body.termsVersion
        : topVersion;
    const text =
      typeof body.bodyMarkdown === 'string'
        ? body.bodyMarkdown
        : typeof body.text === 'string'
          ? body.text
          : '';
    return { termsVersion: version, termsBody: text };
  }
  return { termsVersion: topVersion, termsBody: null };
}

/**
 * Load published form/terms for an event. Empty when no published config or no form.
 */
export async function loadPublishedFormTerms(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<PublishedFormTerms> {
  const rows = await tx.$queryRaw<
    Array<{
      published_config_version: number | null;
      payload: Prisma.JsonValue | null;
    }>
  >`
    SELECT e.published_config_version, v.payload
    FROM events e
    LEFT JOIN event_config_versions v
      ON v.tenant_id = e.tenant_id
     AND v.event_id = e.id
     AND v.version = e.published_config_version
    WHERE e.tenant_id = ${tenantId}::uuid
      AND e.id = ${eventId}::uuid
  `;
  const row = rows[0];
  if (!row || row.published_config_version == null || row.payload == null) {
    return {
      form: null,
      termsVersion: null,
      termsBody: null,
      publishedConfigVersion: null,
    };
  }
  if (typeof row.payload !== 'object' || Array.isArray(row.payload)) {
    return {
      form: null,
      termsVersion: null,
      termsBody: null,
      publishedConfigVersion: row.published_config_version,
    };
  }
  const payload = row.payload as Record<string, unknown>;
  const form =
    asFormDefinition(payload.form) ??
    asFormDefinition(payload.formDefinition) ??
    null;
  const terms = termsFromPayload(payload);
  return {
    form,
    termsVersion: terms.termsVersion,
    termsBody: terms.termsBody,
    publishedConfigVersion: row.published_config_version,
  };
}

/**
 * Allowlist parsers for C-N admin BFF bodies.
 * Only forwards exact contract fields — no generic JSON passthrough.
 */

import {
  NOTIFICATION_KINDS,
  type NotificationKind,
} from '@ticket/contracts';
import {
  buildReminderCreateBody,
  buildReminderPreviewBody,
  buildRetryBody,
  buildTemplatePreviewBody,
  buildTemplatePublishBody,
  isNotificationKind,
} from './notifications';
import { bffApiError } from '../bff/api-error';
import { isUuid } from '../bff/ids';

export type ParsedScope = { tenantId: string; eventId: string };

export function requireScope(body: {
  tenantId?: string;
  eventId?: string;
}): Response | ParsedScope {
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  return { tenantId, eventId };
}

export function requireIdempotencyKey(
  raw: string | undefined,
): Response | string {
  const key = raw?.trim() ?? '';
  if (!isUuid(key)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  return key;
}

export function requireExpectedRevision(
  value: unknown,
): Response | number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return bffApiError(
      'INVALID_INPUT',
      'expectedEventRevision must be a non-negative integer.',
      422,
    );
  }
  return value;
}

function requireUtcIso(value: unknown): Response | string {
  if (typeof value !== 'string' || !value.trim()) {
    return bffApiError(
      'INVALID_INPUT',
      'scheduledAt must be a UTC ISO-8601 string.',
      422,
    );
  }
  const trimmed = value.trim();
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    return bffApiError(
      'INVALID_INPUT',
      'scheduledAt must be a valid UTC ISO-8601 timestamp.',
      422,
    );
  }
  // Reject naive local without Z/offset — contract requires absolute UTC.
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return bffApiError(
      'INVALID_INPUT',
      'scheduledAt must include UTC offset or Z.',
      422,
    );
  }
  return new Date(ms).toISOString();
}

function requireKind(value: unknown): Response | NotificationKind {
  if (!isNotificationKind(value)) {
    return bffApiError(
      'KIND_UNSUPPORTED',
      `kind must be one of: ${NOTIFICATION_KINDS.join(', ')}.`,
      422,
    );
  }
  return value;
}

function requireTemplateText(
  subject: unknown,
  bodyText: unknown,
  bodyHtml: unknown,
): Response | { subject: string; bodyText: string; bodyHtml: string } {
  if (typeof subject !== 'string' || !subject.trim()) {
    return bffApiError('INVALID_INPUT', 'subject is required.', 422);
  }
  if (typeof bodyText !== 'string' || !bodyText.trim()) {
    return bffApiError('INVALID_INPUT', 'bodyText is required.', 422);
  }
  if (typeof bodyHtml !== 'string') {
    return bffApiError('INVALID_INPUT', 'bodyHtml is required.', 422);
  }
  if (subject.length > 500 || bodyText.length > 20_000 || bodyHtml.length > 40_000) {
    return bffApiError('INVALID_INPUT', 'template fields exceed size limits.', 422);
  }
  return {
    subject: subject.trim(),
    bodyText,
    bodyHtml,
  };
}

type LooseBody = Record<string, unknown>;

function sampleVariablesFrom(
  value: unknown,
): Response | Record<string, string> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return bffApiError(
      'INVALID_INPUT',
      'sampleVariables must be an object of string values.',
      422,
    );
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || typeof raw !== 'string') {
      return bffApiError(
        'INVALID_INPUT',
        'sampleVariables keys/values must be allowlisted string pairs.',
        422,
      );
    }
    // Cap sample values; never forward tokens/PII-shaped secrets as samples.
    if (raw.length > 500) {
      return bffApiError(
        'INVALID_INPUT',
        'sampleVariables values must be ≤500 chars.',
        422,
      );
    }
    out[key] = raw;
  }
  return out;
}

export function parseTemplatePreviewBody(
  body: LooseBody,
):
  | Response
  | {
      scope: ParsedScope;
      payload: ReturnType<typeof buildTemplatePreviewBody>;
    } {
  const scope = requireScope(body);
  if (scope instanceof Response) return scope;
  const kind = requireKind(body.kind);
  if (kind instanceof Response) return kind;
  const text = requireTemplateText(body.subject, body.bodyText, body.bodyHtml);
  if (text instanceof Response) return text;
  const sampleVariables = sampleVariablesFrom(body.sampleVariables);
  if (sampleVariables instanceof Response) return sampleVariables;
  return {
    scope,
    payload: buildTemplatePreviewBody({
      kind,
      subject: text.subject,
      bodyText: text.bodyText,
      bodyHtml: text.bodyHtml,
      sampleVariables,
    }),
  };
}

export function parseTemplatePublishBody(
  body: LooseBody,
):
  | Response
  | {
      scope: ParsedScope;
      payload: ReturnType<typeof buildTemplatePublishBody>;
      idempotencyKey: string;
    } {
  const scope = requireScope(body);
  if (scope instanceof Response) return scope;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const kind = requireKind(body.kind);
  if (kind instanceof Response) return kind;
  const text = requireTemplateText(body.subject, body.bodyText, body.bodyHtml);
  if (text instanceof Response) return text;
  return {
    scope,
    idempotencyKey,
    payload: buildTemplatePublishBody({
      kind,
      subject: text.subject,
      bodyText: text.bodyText,
      bodyHtml: text.bodyHtml,
    }),
  };
}

export function parseReminderPreviewBody(
  body: LooseBody,
):
  | Response
  | {
      scope: ParsedScope;
      payload: ReturnType<typeof buildReminderPreviewBody>;
    } {
  const scope = requireScope(body);
  if (scope instanceof Response) return scope;
  const expectedEventRevision = requireExpectedRevision(
    body.expectedEventRevision,
  );
  if (expectedEventRevision instanceof Response) return expectedEventRevision;
  const scheduledAt = requireUtcIso(body.scheduledAt);
  if (scheduledAt instanceof Response) return scheduledAt;
  return {
    scope,
    payload: buildReminderPreviewBody({
      expectedEventRevision,
      scheduledAt,
    }),
  };
}

export function parseReminderCreateBody(
  body: LooseBody,
):
  | Response
  | {
      scope: ParsedScope;
      payload: ReturnType<typeof buildReminderCreateBody>;
      idempotencyKey: string;
    } {
  const scope = requireScope(body);
  if (scope instanceof Response) return scope;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const expectedEventRevision = requireExpectedRevision(
    body.expectedEventRevision,
  );
  if (expectedEventRevision instanceof Response) return expectedEventRevision;
  const scheduledAt = requireUtcIso(body.scheduledAt);
  if (scheduledAt instanceof Response) return scheduledAt;
  // Force transactional audience — reject marketing segments.
  if (
    body.audience !== undefined &&
    body.audience !== 'TICKET_OWNERS'
  ) {
    return bffApiError(
      'INVALID_INPUT',
      'audience must be TICKET_OWNERS (transactional only).',
      422,
    );
  }
  if (body.kind !== undefined && body.kind !== 'EventReminder') {
    return bffApiError(
      'KIND_UNSUPPORTED',
      'reminder kind must be EventReminder.',
      422,
    );
  }
  return {
    scope,
    idempotencyKey,
    payload: buildReminderCreateBody({
      expectedEventRevision,
      scheduledAt,
    }),
  };
}

export function parseReminderCancelBody(
  body: LooseBody,
): Response | { scope: ParsedScope; idempotencyKey: string } {
  const scope = requireScope(body);
  if (scope instanceof Response) return scope;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  return { scope, idempotencyKey };
}

export function parseRetryBody(
  body: LooseBody,
):
  | Response
  | {
      scope: ParsedScope;
      payload: ReturnType<typeof buildRetryBody>;
      idempotencyKey: string;
    } {
  const scope = requireScope(body);
  if (scope instanceof Response) return scope;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    return bffApiError(
      'INVALID_INPUT',
      'reason is required for audited retry.',
      422,
    );
  }
  if (body.reason.trim().length > 500) {
    return bffApiError('INVALID_INPUT', 'reason must be ≤500 chars.', 422);
  }
  return {
    scope,
    idempotencyKey,
    payload: buildRetryBody(body.reason),
  };
}

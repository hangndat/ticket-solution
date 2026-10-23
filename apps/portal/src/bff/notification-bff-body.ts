/**
 * Allowlist parsers for C-N portal BFF bodies (tenant/event from route params).
 */

import {
  NOTIFICATION_KINDS,
  type NotificationKind,
} from '@ticket/contracts';
import {
  buildReminderCreateBody,
  buildReminderPreviewBody,
  buildTemplatePreviewBody,
  buildTemplatePublishBody,
  isNotificationKind,
} from '../ops/notifications';
import { bffApiError } from './api-error';
import { isUuid } from './ids';

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
  | { payload: ReturnType<typeof buildTemplatePreviewBody> } {
  const kind = requireKind(body.kind);
  if (kind instanceof Response) return kind;
  const text = requireTemplateText(body.subject, body.bodyText, body.bodyHtml);
  if (text instanceof Response) return text;
  const sampleVariables = sampleVariablesFrom(body.sampleVariables);
  if (sampleVariables instanceof Response) return sampleVariables;
  return {
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
      payload: ReturnType<typeof buildTemplatePublishBody>;
      idempotencyKey: string;
    } {
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const kind = requireKind(body.kind);
  if (kind instanceof Response) return kind;
  const text = requireTemplateText(body.subject, body.bodyText, body.bodyHtml);
  if (text instanceof Response) return text;
  return {
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
  | { payload: ReturnType<typeof buildReminderPreviewBody> } {
  const expectedEventRevision = requireExpectedRevision(
    body.expectedEventRevision,
  );
  if (expectedEventRevision instanceof Response) return expectedEventRevision;
  const scheduledAt = requireUtcIso(body.scheduledAt);
  if (scheduledAt instanceof Response) return scheduledAt;
  return {
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
      payload: ReturnType<typeof buildReminderCreateBody>;
      idempotencyKey: string;
    } {
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
    idempotencyKey,
    payload: buildReminderCreateBody({
      expectedEventRevision,
      scheduledAt,
    }),
  };
}

export function parseReminderCancelBody(
  body: LooseBody,
): Response | { idempotencyKey: string } {
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  return { idempotencyKey };
}

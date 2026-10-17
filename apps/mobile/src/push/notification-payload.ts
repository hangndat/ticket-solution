import {
  NOTIFICATION_KINDS,
  NOTIFICATION_PAYLOAD_VERSIONS,
  type NotificationKind,
} from './notification-contract.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Published path slug — never used as fixture event id. */
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,80}$/;

export type ParsedPushPayload =
  | {
      ok: true;
      kind: NotificationKind;
      payloadVersion: number;
      ticketId?: string;
      eventId?: string;
      tenantId?: string;
      tenantSlug?: string;
      eventSlug?: string;
    }
  | {
      ok: false;
      reason:
        | 'missing'
        | 'not-object'
        | 'kind-unsupported'
        | 'version-unsupported'
        | 'invalid-ref'
        | 'missing-route-refs';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalUuid(
  value: unknown,
): { ok: true; value?: string } | { ok: false } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'string' || !UUID.test(value)) return { ok: false };
  return { ok: true, value };
}

function optionalSlug(
  value: unknown,
): { ok: true; value?: string } | { ok: false } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'string' || !SLUG.test(value)) return { ok: false };
  return { ok: true, value };
}

function isKind(value: unknown): value is NotificationKind {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Validate APNs/expo notification `content.data` against C-N allowlists.
 * Opaque UUID refs only; event routing uses tenantSlug/eventSlug — never
 * fixture `/events/fixture/{eventId}`.
 */
export function parsePushNotificationData(data: unknown): ParsedPushPayload {
  if (data === undefined || data === null) {
    return { ok: false, reason: 'missing' };
  }
  if (!isRecord(data)) return { ok: false, reason: 'not-object' };

  if (!isKind(data.kind)) {
    return { ok: false, reason: 'kind-unsupported' };
  }
  const kind = data.kind;
  const versionRaw = data.payloadVersion;
  if (typeof versionRaw !== 'number' || !Number.isInteger(versionRaw)) {
    return { ok: false, reason: 'version-unsupported' };
  }
  const allowed = NOTIFICATION_PAYLOAD_VERSIONS[kind] as readonly number[];
  if (!allowed.includes(versionRaw)) {
    return { ok: false, reason: 'version-unsupported' };
  }

  const ticketId = optionalUuid(data.ticketId);
  const eventId = optionalUuid(data.eventId);
  const tenantId = optionalUuid(data.tenantId);
  const tenantSlug = optionalSlug(data.tenantSlug);
  const eventSlug = optionalSlug(data.eventSlug);
  if (
    !ticketId.ok ||
    !eventId.ok ||
    !tenantId.ok ||
    !tenantSlug.ok ||
    !eventSlug.ok
  ) {
    return { ok: false, reason: 'invalid-ref' };
  }

  if (kind === 'TicketIssued') {
    if (!ticketId.value) return { ok: false, reason: 'missing-route-refs' };
    return {
      ok: true,
      kind,
      payloadVersion: versionRaw,
      ticketId: ticketId.value,
      eventId: eventId.value,
      tenantId: tenantId.value,
      tenantSlug: tenantSlug.value,
      eventSlug: eventSlug.value,
    };
  }

  // Event / invitation taps require published slug pair — never eventId→fixture.
  if (!tenantSlug.value || !eventSlug.value) {
    return { ok: false, reason: 'missing-route-refs' };
  }
  return {
    ok: true,
    kind,
    payloadVersion: versionRaw,
    ticketId: ticketId.value,
    eventId: eventId.value,
    tenantId: tenantId.value,
    tenantSlug: tenantSlug.value,
    eventSlug: eventSlug.value,
  };
}

/** Stable response id for last-response consumption dedupe. */
export function notificationResponseId(input: {
  identifier: string;
  date: number;
  actionIdentifier: string;
}): string {
  return `${input.identifier}|${input.date}|${input.actionIdentifier}`;
}

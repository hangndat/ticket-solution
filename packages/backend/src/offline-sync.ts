/**
 * D7 offline sync — pure contract helpers + schema-only stub (#105).
 * Durable apply / conflict resolution → Issue #106.
 */

import {
  OFFLINE_SYNC_ERROR_CODES,
  OFFLINE_SYNC_EVENT_TYPES,
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  OFFLINE_SYNC_PAYLOAD_VERSION,
  compareOfflineReplayOrder,
  isWithinOfflineClockSkew,
  type OfflineSyncEvent,
  type OfflineSyncRequestBody,
} from '@ticket/contracts';
import { GateError, GATE_ERROR_CODES } from './gate-error';

export {
  compareOfflineReplayOrder,
  isWithinOfflineClockSkew,
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_TYPE_SET = new Set<string>(OFFLINE_SYNC_EVENT_TYPES);

function requireUuid(value: string | undefined, name: string): string {
  const trimmed = value?.trim() ?? '';
  if (!UUID.test(trimmed)) {
    throw new GateError(
      GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
      `${name} must be a UUID`,
    );
  }
  return trimmed;
}

/**
 * Sort a batch into deterministic server apply order (ADR-18).
 * Does not mutate the input array.
 */
export function sortOfflineEventsForReplay(
  events: OfflineSyncEvent[],
): OfflineSyncEvent[] {
  return [...events].sort(compareOfflineReplayOrder);
}

/**
 * Validate transport shape + clock skew + batch limits.
 * Does not touch the database. Throws GateError for whole-batch failures.
 */
export function validateOfflineSyncRequest(
  pathEventId: string,
  body: OfflineSyncRequestBody,
  serverEpochMs: number = Date.now(),
): {
  tenantId: string;
  staffSessionId: string;
  deviceId: string;
  events: OfflineSyncEvent[];
} {
  const tenantId = requireUuid(body?.tenantId, 'tenantId');
  const staffSessionId = requireUuid(body?.staffSessionId, 'staffSessionId');
  const deviceId = requireUuid(body?.deviceId, 'deviceId');
  const eventId = requireUuid(pathEventId, 'eventId');

  if (!Array.isArray(body?.events)) {
    throw new GateError(
      GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
      'events must be an array',
    );
  }
  if (body.events.length > OFFLINE_SYNC_MAX_BATCH) {
    throw new GateError(
      GATE_ERROR_CODES.OFFLINE_SYNC_BATCH_TOO_LARGE,
      `events exceeds max batch size ${OFFLINE_SYNC_MAX_BATCH}`,
    );
  }

  if (
    !isWithinOfflineClockSkew(
      body.clientClockAt,
      serverEpochMs,
      OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
    )
  ) {
    throw new GateError(
      GATE_ERROR_CODES.OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED,
      `clientClockAt outside ±${OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS}s of server clock`,
    );
  }

  const seenIds = new Set<string>();
  const normalized: OfflineSyncEvent[] = [];

  for (const raw of body.events) {
    const clientEventId = requireUuid(raw?.clientEventId, 'clientEventId');
    if (seenIds.has(clientEventId)) {
      throw new GateError(
        GATE_ERROR_CODES.OFFLINE_SYNC_IDEMPOTENCY_CONFLICT,
        'duplicate clientEventId in the same batch',
      );
    }
    seenIds.add(clientEventId);

    if (!EVENT_TYPE_SET.has(raw?.type)) {
      throw new GateError(
        GATE_ERROR_CODES.OFFLINE_SYNC_EVENT_TYPE_UNSUPPORTED,
        `unsupported offline event type: ${String(raw?.type)}`,
      );
    }

    if (raw.payloadVersion !== OFFLINE_SYNC_PAYLOAD_VERSION) {
      throw new GateError(
        GATE_ERROR_CODES.OFFLINE_SYNC_PAYLOAD_VERSION_UNSUPPORTED,
        `payloadVersion must be ${OFFLINE_SYNC_PAYLOAD_VERSION}`,
      );
    }

    const itemEventId = requireUuid(raw?.eventId, 'events[].eventId');
    if (itemEventId !== eventId) {
      throw new GateError(
        GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
        'events[].eventId must match path eventId',
      );
    }

    const ticketId = requireUuid(raw?.ticketId, 'ticketId');
    if (
      typeof raw.clientSeq !== 'number' ||
      !Number.isInteger(raw.clientSeq) ||
      raw.clientSeq < 0
    ) {
      throw new GateError(
        GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
        'clientSeq must be a non-negative integer',
      );
    }

    if (
      !isWithinOfflineClockSkew(
        raw.clientOccurredAt,
        serverEpochMs,
        OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
      )
    ) {
      throw new GateError(
        GATE_ERROR_CODES.OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED,
        `clientOccurredAt outside ±${OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS}s for ${clientEventId}`,
      );
    }

    normalized.push({
      clientEventId,
      type: raw.type,
      eventId: itemEventId,
      ticketId,
      clientOccurredAt: raw.clientOccurredAt,
      clientSeq: raw.clientSeq,
      payloadVersion: OFFLINE_SYNC_PAYLOAD_VERSION,
    });
  }

  return {
    tenantId,
    staffSessionId,
    deviceId,
    events: sortOfflineEventsForReplay(normalized),
  };
}

/**
 * Schema-only gate for #105: validate transport then refuse apply until #106.
 */
export function offlineSyncNotImplemented(
  pathEventId: string,
  body: OfflineSyncRequestBody,
  serverEpochMs?: number,
): never {
  validateOfflineSyncRequest(pathEventId, body, serverEpochMs);
  throw new GateError(
    GATE_ERROR_CODES.OFFLINE_SYNC_NOT_IMPLEMENTED,
    'Offline sync apply is not implemented yet (Issue #106)',
  );
}

/** Re-export contract codes for backend callers. */
export { OFFLINE_SYNC_ERROR_CODES };

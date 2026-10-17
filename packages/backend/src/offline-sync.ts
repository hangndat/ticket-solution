/**
 * D7 offline sync — transport validation + durable idempotent apply (#106/#107).
 * Safe queue replay: same apply path for API and worker callers.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import {
  OFFLINE_SYNC_ERROR_CODES,
  OFFLINE_SYNC_EVENT_TYPES,
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
  OFFLINE_SYNC_PAYLOAD_VERSION,
  compareOfflineReplayOrder,
  isWithinOfflineClockSkew,
  type OfflineSyncEvent,
  type OfflineSyncItemResult,
  type OfflineSyncRequestBody,
  type OfflineSyncResponse,
} from '@ticket/contracts';
import { GateError, GATE_ERROR_CODES } from './gate-error';
import { assertOpenForGate } from './event-policy';
import { requireTenantPermission } from './membership';
import { metricsInc } from './metrics-registry';

export {
  compareOfflineReplayOrder,
  isWithinOfflineClockSkew,
  OFFLINE_SYNC_MAX_BATCH,
  OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_TYPE_SET = new Set<string>(OFFLINE_SYNC_EVENT_TYPES);
const PERMISSION_CONFIRM = 'gate.confirm';

type TicketLock = {
  id: string;
  state: string;
};

type LedgerRow = {
  client_event_id: string;
  payload_hash: string;
  checkin_id: string;
  ticket_id: string;
  client_occurred_at: Date;
  client_seq: number;
};

type CheckinWinner = {
  id: string;
  device_id: string | null;
  client_event_id: string | null;
  source: string;
};

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

/** Canonical hash for idempotency (same key + different hash → conflict). */
export function offlineEventPayloadHash(event: OfflineSyncEvent): string {
  return createHash('sha256')
    .update(
      [
        event.type,
        event.eventId,
        event.ticketId,
        event.clientOccurredAt,
        String(event.clientSeq),
        String(event.payloadVersion),
      ].join('\0'),
      'utf8',
    )
    .digest('hex');
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
 * @deprecated Prefer applyOfflineSyncBatch. Kept for #105 stub tests until removed.
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

async function assertSessionActive(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  sessionId: string,
  userId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM staff_sessions
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND id = ${sessionId}::uuid
      AND user_id = ${userId}::uuid
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
    FOR SHARE
  `;
  if (!rows[0]) {
    throw new GateError(
      GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
      'Staff session is not active',
    );
  }
}

async function lockTicket(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  ticketId: string,
): Promise<TicketLock | undefined> {
  const rows = await tx.$queryRaw<TicketLock[]>`
    SELECT id, state
    FROM tickets
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND id = ${ticketId}::uuid
    FOR UPDATE
  `;
  return rows[0];
}

async function currentCheckin(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<CheckinWinner | undefined> {
  const rows = await tx.$queryRaw<CheckinWinner[]>`
    SELECT id, device_id, client_event_id, source
    FROM checkins
    WHERE tenant_id = ${tenantId}::uuid
      AND ticket_id = ${ticketId}::uuid
      AND undone_at IS NULL
    FOR UPDATE
  `;
  return rows[0];
}

async function readLedger(
  tx: Prisma.TransactionClient,
  tenantId: string,
  clientEventId: string,
): Promise<LedgerRow | undefined> {
  const rows = await tx.$queryRaw<LedgerRow[]>`
    SELECT client_event_id, payload_hash, checkin_id, ticket_id,
           client_occurred_at, client_seq
    FROM offline_sync_events
    WHERE tenant_id = ${tenantId}::uuid
      AND client_event_id = ${clientEventId}::uuid
    FOR UPDATE
  `;
  return rows[0];
}

async function maxClientSeqForDeviceSession(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  deviceId: string,
  staffSessionId: string,
): Promise<number | null> {
  const rows = await tx.$queryRaw<Array<{ max_seq: number | null }>>`
    SELECT MAX(client_seq) AS max_seq
    FROM offline_sync_events
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND device_id = ${deviceId}::uuid
      AND staff_session_id = ${staffSessionId}::uuid
  `;
  const max = rows[0]?.max_seq;
  return typeof max === 'number' ? max : max == null ? null : Number(max);
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId: string;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type, resource_id, reason
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${randomUUID()}::uuid,
      ${input.actorUserId}::uuid,
      ${input.action},
      ${input.resourceType},
      ${input.resourceId}::uuid,
      NULL
    )
  `;
}

function conflictResult(
  clientEventId: string,
  code: typeof GATE_ERROR_CODES.ALREADY_CHECKED_IN | typeof GATE_ERROR_CODES.OFFLINE_SYNC_CONFLICT_LOST,
  winner: CheckinWinner | undefined,
  message: string,
): OfflineSyncItemResult {
  return {
    clientEventId,
    status: 'CONFLICT',
    code,
    message,
    winningCheckinId: winner?.id,
    winningDeviceId: winner?.device_id ?? undefined,
  };
}

async function applyOneOfflineEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    deviceId: string;
    staffSessionId: string;
    actorUserId: string;
    event: OfflineSyncEvent;
  },
): Promise<OfflineSyncItemResult> {
  const { event } = input;
  const payloadHash = offlineEventPayloadHash(event);

  const prior = await readLedger(tx, input.tenantId, event.clientEventId);
  if (prior) {
    if (prior.payload_hash === payloadHash) {
      return {
        clientEventId: event.clientEventId,
        status: 'DUPLICATE',
        checkinId: prior.checkin_id,
      };
    }
    return {
      clientEventId: event.clientEventId,
      status: 'REJECTED',
      code: GATE_ERROR_CODES.OFFLINE_SYNC_IDEMPOTENCY_CONFLICT,
      message: 'clientEventId already applied with a different payload',
    };
  }

  const maxSeq = await maxClientSeqForDeviceSession(
    tx,
    input.tenantId,
    input.eventId,
    input.deviceId,
    input.staffSessionId,
  );
  if (maxSeq !== null && event.clientSeq < maxSeq) {
    return {
      clientEventId: event.clientEventId,
      status: 'REJECTED',
      code: GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
      message: 'clientSeq went backwards for this device+staff session',
    };
  }

  const ticket = await lockTicket(
    tx,
    input.tenantId,
    input.eventId,
    event.ticketId,
  );
  if (!ticket) {
    return {
      clientEventId: event.clientEventId,
      status: 'REJECTED',
      code: GATE_ERROR_CODES.TICKET_NOT_FOUND,
      message: 'Ticket not found',
    };
  }

  const winner = await currentCheckin(tx, input.tenantId, event.ticketId);
  if (winner?.client_event_id === event.clientEventId) {
    return {
      clientEventId: event.clientEventId,
      status: 'DUPLICATE',
      checkinId: winner.id,
    };
  }
  if (winner || ticket.state === 'USED') {
    const code =
      winner?.source === 'OFFLINE'
        ? GATE_ERROR_CODES.OFFLINE_SYNC_CONFLICT_LOST
        : GATE_ERROR_CODES.ALREADY_CHECKED_IN;
    return conflictResult(
      event.clientEventId,
      code,
      winner,
      'Ticket already has a current check-in',
    );
  }

  if (ticket.state !== 'ACTIVE') {
    return {
      clientEventId: event.clientEventId,
      status: 'REJECTED',
      code: GATE_ERROR_CODES.TICKET_NOT_FOUND,
      message: 'Ticket is not active for offline check-in',
    };
  }

  // Offline apply is durable admit: supersede any transient online HELD.
  await tx.$executeRaw`
    UPDATE checkin_reservations
    SET status = 'EXPIRED'
    WHERE tenant_id = ${input.tenantId}::uuid
      AND ticket_id = ${event.ticketId}::uuid
      AND status = 'HELD'
  `;

  const savepoint = `offline_item_${event.clientEventId.replace(/-/g, '')}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    const reservationId = randomUUID();
    const tokenHash = createHash('sha256')
      .update(`offline:${event.clientEventId}`, 'utf8')
      .digest('hex');
    await tx.$executeRaw`
      INSERT INTO checkin_reservations (
        tenant_id, event_id, id, ticket_id, staff_session_id, token_hash, status, expires_at
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.eventId}::uuid,
        ${reservationId}::uuid,
        ${event.ticketId}::uuid,
        ${input.staffSessionId}::uuid,
        ${tokenHash},
        'CONFIRMED',
        clock_timestamp()
      )
    `;

    const checkinId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO checkins (
        tenant_id, event_id, id, ticket_id, reservation_id, staff_session_id,
        actor_user_id, source, device_id, client_event_id
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.eventId}::uuid,
        ${checkinId}::uuid,
        ${event.ticketId}::uuid,
        ${reservationId}::uuid,
        ${input.staffSessionId}::uuid,
        ${input.actorUserId}::uuid,
        'OFFLINE',
        ${input.deviceId}::uuid,
        ${event.clientEventId}::uuid
      )
    `;

    await tx.$executeRaw`
      UPDATE tickets
      SET state = 'USED', updated_at = clock_timestamp()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${event.ticketId}::uuid
    `;

    await tx.$executeRaw`
      INSERT INTO offline_sync_events (
        tenant_id, event_id, client_event_id, device_id, staff_session_id,
        ticket_id, client_occurred_at, client_seq, payload_hash, checkin_id, actor_user_id
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.eventId}::uuid,
        ${event.clientEventId}::uuid,
        ${input.deviceId}::uuid,
        ${input.staffSessionId}::uuid,
        ${event.ticketId}::uuid,
        ${event.clientOccurredAt}::timestamptz,
        ${event.clientSeq},
        ${payloadHash},
        ${checkinId}::uuid,
        ${input.actorUserId}::uuid
      )
    `;

    await writeAudit(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      action: 'gate.offline_sync.apply',
      resourceType: 'checkin',
      resourceId: checkinId,
    });

    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
    metricsInc('gate_offline_sync_total', { result: 'applied' });
    return {
      clientEventId: event.clientEventId,
      status: 'APPLIED',
      checkinId,
    };
  } catch {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    const raced = await readLedger(tx, input.tenantId, event.clientEventId);
    if (raced && raced.payload_hash === payloadHash) {
      return {
        clientEventId: event.clientEventId,
        status: 'DUPLICATE',
        checkinId: raced.checkin_id,
      };
    }
    if (raced) {
      return {
        clientEventId: event.clientEventId,
        status: 'REJECTED',
        code: GATE_ERROR_CODES.OFFLINE_SYNC_IDEMPOTENCY_CONFLICT,
        message: 'clientEventId already applied with a different payload',
      };
    }
    const again = await currentCheckin(tx, input.tenantId, event.ticketId);
    if (again) {
      const code =
        again.source === 'OFFLINE'
          ? GATE_ERROR_CODES.OFFLINE_SYNC_CONFLICT_LOST
          : GATE_ERROR_CODES.ALREADY_CHECKED_IN;
      return conflictResult(
        event.clientEventId,
        code,
        again,
        'Ticket already has a current check-in',
      );
    }
    throw new GateError(
      GATE_ERROR_CODES.OFFLINE_SYNC_REPLAY_ORDER_INVALID,
      'Offline apply failed unexpectedly',
    );
  }
}

export type ApplyOfflineSyncInput = {
  pathEventId: string;
  body: OfflineSyncRequestBody;
  actorUserId: string;
  /** Override server clock for skew checks (tests). */
  serverEpochMs?: number;
};

/**
 * Durable offline queue replay: validate → authz/session/window → apply in
 * ADR-18 order with idempotency + conflict codes. Safe for API and worker.
 */
export async function applyOfflineSyncBatch(
  tx: Prisma.TransactionClient,
  input: ApplyOfflineSyncInput,
): Promise<OfflineSyncResponse> {
  const serverEpochMs = input.serverEpochMs ?? Date.now();
  const validated = validateOfflineSyncRequest(
    input.pathEventId,
    input.body,
    serverEpochMs,
  );

  await requireTenantPermission(tx, {
    tenantId: validated.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIRM,
    eventId: input.pathEventId,
  });
  await assertOpenForGate(tx, validated.tenantId, input.pathEventId);
  await assertSessionActive(
    tx,
    validated.tenantId,
    input.pathEventId,
    validated.staffSessionId,
    input.actorUserId,
  );

  const results: OfflineSyncItemResult[] = [];
  for (const event of validated.events) {
    results.push(
      await applyOneOfflineEvent(tx, {
        tenantId: validated.tenantId,
        eventId: input.pathEventId,
        deviceId: validated.deviceId,
        staffSessionId: validated.staffSessionId,
        actorUserId: input.actorUserId,
        event,
      }),
    );
  }

  return {
    serverTime: new Date(serverEpochMs).toISOString(),
    maxClockSkewSeconds: OFFLINE_SYNC_MAX_CLOCK_SKEW_SECONDS,
    results,
  };
}

/** Re-export contract codes for backend callers. */
export { OFFLINE_SYNC_ERROR_CODES };

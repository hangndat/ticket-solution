import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { GateError, GATE_ERROR_CODES } from './gate-error';
import { assertOpenForGate } from './event-policy';
import { requireTenantPermission } from './membership';
import { metricsInc, metricsObserveSeconds } from './metrics-registry';
import {
  canonicalHash,
  claimOperation,
  completeOperation,
  requireIdempotencyKey,
} from './event-operations';
import { sealCredentialToken } from './credential-crypto';
import { AuthzError, AUTHZ_ERROR_CODES } from './authz-error';

const PERMISSION_CONFIRM = 'gate.confirm';
const PERMISSION_UNDO = 'gate.undo';
const PERMISSION_REVOKE = 'ticket.revoke';
const PERMISSION_REISSUE = 'ticket.reissue';
const REISSUE_COMMAND = 'ticket.reissue';

type TicketLock = {
  id: string;
  state: string;
  credential_version: number;
};

type HoldRow = {
  id: string;
  staff_session_id: string;
  token_hash: string;
  status: string;
  expires_at: Date;
};

export type StaffSessionResult = {
  sessionId: string;
  eventId: string;
  status: 'ACTIVE';
  /** O31: null when opened without a gate (legacy / event without gates). */
  gateId: string | null;
  gateName: string | null;
};

export type GateRecord = {
  id: string;
  eventId: string;
  name: string;
  sortOrder: number;
};

export type ReserveResult = {
  reservationId: string;
  token: string;
  expiresAt: Date;
  ticketId: string;
};

export type ConfirmResult = {
  checkinId: string;
  ticketId: string;
  reservationId: string;
  state: 'USED';
};

/** Business deny that must commit (audit) — unwrap to GateError outside withTenant. */
export type GateDenyOutcome = {
  ok: false;
  code: (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];
  message: string;
};

export type ReserveOutcome =
  | ({ ok: true } & ReserveResult)
  | GateDenyOutcome;

export type ConfirmOutcome =
  | ({ ok: true } & ConfirmResult)
  | GateDenyOutcome;

export function unwrapReserveOutcome(outcome: ReserveOutcome): ReserveResult {
  if (!outcome.ok) {
    throw new GateError(outcome.code, outcome.message);
  }
  return {
    reservationId: outcome.reservationId,
    token: outcome.token,
    expiresAt: outcome.expiresAt,
    ticketId: outcome.ticketId,
  };
}

export function unwrapConfirmOutcome(outcome: ConfirmOutcome): ConfirmResult {
  if (!outcome.ok) {
    throw new GateError(outcome.code, outcome.message);
  }
  return {
    checkinId: outcome.checkinId,
    ticketId: outcome.ticketId,
    reservationId: outcome.reservationId,
    state: outcome.state,
  };
}

export type UndoResult = {
  checkinId: string;
  ticketId: string;
  state: 'ACTIVE';
};

export type ReissueResult = {
  ticketId: string;
  credentialVersion: number;
  replayed: boolean;
};

export type ReissueOutcome = ({ ok: true } & ReissueResult) | GateDenyOutcome;

export function unwrapReissueOutcome(outcome: ReissueOutcome): ReissueResult {
  if (!outcome.ok) {
    throw new GateError(outcome.code, outcome.message);
  }
  return {
    ticketId: outcome.ticketId,
    credentialVersion: outcome.credentialVersion,
    replayed: outcome.replayed,
  };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

async function lockTicket(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  ticketId: string,
): Promise<TicketLock> {
  const rows = await tx.$queryRaw<TicketLock[]>`
    SELECT id, state, credential_version
    FROM tickets
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND id = ${ticketId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new GateError(GATE_ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
  }
  return row;
}

async function expireHeld(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE checkin_reservations
    SET status = 'EXPIRED'
    WHERE tenant_id = ${tenantId}::uuid
      AND ticket_id = ${ticketId}::uuid
      AND status = 'HELD'
      AND expires_at <= clock_timestamp()
  `;
}

async function currentHold(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<HoldRow | undefined> {
  const rows = await tx.$queryRaw<HoldRow[]>`
    SELECT id, staff_session_id, token_hash, status, expires_at
    FROM checkin_reservations
    WHERE tenant_id = ${tenantId}::uuid
      AND ticket_id = ${ticketId}::uuid
      AND status = 'HELD'
    FOR UPDATE
  `;
  return rows[0];
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

async function currentCheckinId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<string | undefined> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM checkins
    WHERE tenant_id = ${tenantId}::uuid
      AND ticket_id = ${ticketId}::uuid
      AND undone_at IS NULL
    FOR UPDATE
  `;
  return rows[0]?.id;
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
    reason?: string;
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
      ${input.reason ?? null}
    )
  `;
}

/**
 * Persist a Gate reject for EventReport.rejectByReason (O12 / audit `gate.reject`).
 * When `idempotent` is true, skip insert if the same tenant/event/reason/resource
 * already has a `gate.reject` row (cheap offline CONFLICT/REJECTED replay).
 */
export async function recordGateReject(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    reason: string;
    resourceType?: string;
    resourceId?: string;
    /** Skip duplicate audit for the same resource+reason (offline replay). */
    idempotent?: boolean;
  },
): Promise<void> {
  const reason = input.reason.trim() || 'UNKNOWN';
  const resourceType = input.resourceType ?? 'gate';
  const resourceId = input.resourceId ?? input.eventId;
  if (input.idempotent) {
    const existing = await tx.$queryRaw<Array<{ ok: number }>>`
      SELECT 1 AS ok
      FROM audit_logs
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND action = 'gate.reject'
        AND resource_id = ${resourceId}::uuid
        AND COALESCE(NULLIF(TRIM(reason), ''), 'UNKNOWN') = ${reason}
      LIMIT 1
    `;
    if (existing[0]) {
      return;
    }
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'gate.reject',
    resourceType,
    resourceId,
    reason,
  });
}

/**
 * Record `gate.reject` and return a deny outcome (do not throw) so withTenant
 * can commit the audit before the API maps to GateError/HTTP.
 */
async function denyGate(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    code: (typeof GATE_ERROR_CODES)[keyof typeof GATE_ERROR_CODES];
    message: string;
    resourceType?: string;
    resourceId?: string;
  },
): Promise<GateDenyOutcome> {
  await recordGateReject(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    reason: input.code,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  });
  return { ok: false, code: input.code, message: input.message };
}

const PERMISSION_EVENT_UPDATE = 'event.update';
const GATE_SORT_ORDER_MIN = 0;
const GATE_SORT_ORDER_MAX = 9999;

function resolveGateSortOrder(sortOrder: number | undefined): number {
  if (sortOrder === undefined) {
    return GATE_SORT_ORDER_MIN;
  }
  if (!Number.isInteger(sortOrder)) {
    throw new GateError(
      GATE_ERROR_CODES.GATE_NOT_FOUND,
      'sortOrder must be an integer',
    );
  }
  if (sortOrder < GATE_SORT_ORDER_MIN || sortOrder > GATE_SORT_ORDER_MAX) {
    throw new GateError(
      GATE_ERROR_CODES.GATE_NOT_FOUND,
      'sortOrder must be between 0 and 9999',
    );
  }
  return sortOrder;
}

type GateRow = { id: string; event_id: string; name: string; sort_order: number };

function toGateRecord(row: GateRow): GateRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

/** O31: gates of an event for staff pickers (requires gate.confirm on the event). */
export async function listEventGates(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; eventId: string; userId: string },
): Promise<GateRecord[]> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
    permission: PERMISSION_CONFIRM,
    eventId: input.eventId,
  });
  const rows = await tx.$queryRaw<GateRow[]>`
    SELECT id, event_id, name, sort_order
    FROM gates
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
    ORDER BY sort_order ASC, name ASC, id ASC
  `;
  return rows.map(toGateRecord);
}

/** O31: organizer creates a gate (requires event.update on the event). */
export async function createEventGate(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    userId: string;
    name: string;
    sortOrder?: number;
  },
): Promise<GateRecord> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
    permission: PERMISSION_EVENT_UPDATE,
    eventId: input.eventId,
  });
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new GateError(
      GATE_ERROR_CODES.GATE_NOT_FOUND,
      'Gate name must be 1-80 characters',
    );
  }
  const events = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
    FOR SHARE
  `;
  if (!events[0]) {
    throw new GateError(GATE_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }
  const sortOrder = resolveGateSortOrder(input.sortOrder);
  const gateId = randomUUID();
  const rows = await tx.$queryRaw<GateRow[]>`
    INSERT INTO gates (tenant_id, event_id, id, name, sort_order)
    VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${gateId}::uuid,
      ${name},
      ${sortOrder}::int
    )
    ON CONFLICT (tenant_id, event_id, name) DO NOTHING
    RETURNING id, event_id, name, sort_order
  `;
  if (!rows[0]) {
    throw new GateError(
      GATE_ERROR_CODES.GATE_NAME_CONFLICT,
      'A gate with this name already exists for the event',
    );
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.userId,
    action: 'gate.create',
    resourceType: 'gate',
    resourceId: gateId,
  });
  return toGateRecord(rows[0]);
}

export async function openStaffSession(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    userId: string;
    gateId?: string | null;
  },
): Promise<StaffSessionResult> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.userId,
    permission: PERMISSION_CONFIRM,
    eventId: input.eventId,
  });
  // SEC-1: serialize with ACK revoke; deny while deletion request is open.
  try {
    await tx.$executeRaw`
      SELECT assert_can_open_staff_session(${input.userId}::uuid)
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ACCOUNT_DELETION_OPEN')) {
      throw new GateError(
        GATE_ERROR_CODES.ACCOUNT_DELETION_OPEN,
        'Cannot open staff session while account deletion request is open',
      );
    }
    throw err;
  }
  let gateId: string | null = null;
  let gateName: string | null = null;
  if (input.gateId) {
    const gates = await tx.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT id, name
      FROM gates
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND id = ${input.gateId}::uuid
      FOR SHARE
    `;
    if (!gates[0]) {
      throw new GateError(GATE_ERROR_CODES.GATE_NOT_FOUND, 'Gate not found');
    }
    gateId = gates[0].id;
    gateName = gates[0].name;
  }
  const sessionId = randomUUID();
  try {
    await tx.$executeRaw`
      INSERT INTO staff_sessions (tenant_id, event_id, id, user_id, status, gate_id)
      VALUES (
        ${input.tenantId}::uuid,
        ${input.eventId}::uuid,
        ${sessionId}::uuid,
        ${input.userId}::uuid,
        'ACTIVE',
        ${gateId}::uuid
      )
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ACCOUNT_DELETION_OPEN')) {
      throw new GateError(
        GATE_ERROR_CODES.ACCOUNT_DELETION_OPEN,
        'Cannot open staff session while account deletion request is open',
      );
    }
    throw err;
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.userId,
    action: 'gate.session.open',
    resourceType: 'staff_session',
    resourceId: sessionId,
  });
  return {
    sessionId,
    eventId: input.eventId,
    status: 'ACTIVE',
    gateId,
    gateName,
  };
}

export async function revokeStaffSession(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    sessionId: string;
    actorUserId: string;
  },
): Promise<void> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UNDO,
    eventId: input.eventId,
  });
  const updated = await tx.$executeRaw`
    UPDATE staff_sessions
    SET status = 'REVOKED', revoked_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.sessionId}::uuid
      AND status = 'ACTIVE'
  `;
  if (Number(updated) !== 1) {
    throw new GateError(
      GATE_ERROR_CODES.SESSION_NOT_ACTIVE,
      'Staff session is not active',
    );
  }
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'gate.session.revoke',
    resourceType: 'staff_session',
    resourceId: input.sessionId,
  });
}

export async function reserveCheckin(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    ticketId: string;
    staffSessionId: string;
    actorUserId: string;
  },
): Promise<ReserveOutcome> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIRM,
    eventId: input.eventId,
  });
  await assertOpenForGate(tx, input.tenantId, input.eventId);
  await assertSessionActive(
    tx,
    input.tenantId,
    input.eventId,
    input.staffSessionId,
    input.actorUserId,
  );
  let ticket: TicketLock;
  try {
    ticket = await lockTicket(
      tx,
      input.tenantId,
      input.eventId,
      input.ticketId,
    );
  } catch (err) {
    if (
      err instanceof GateError &&
      err.code === GATE_ERROR_CODES.TICKET_NOT_FOUND
    ) {
      return denyGate(tx, {
        tenantId: input.tenantId,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        code: GATE_ERROR_CODES.TICKET_NOT_FOUND,
        message: err.message,
        resourceType: 'ticket',
        resourceId: input.ticketId,
      });
    }
    throw err;
  }
  if (ticket.state !== 'ACTIVE') {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.TICKET_NOT_ACTIVE,
      message: 'Ticket is not active',
      resourceType: 'ticket',
      resourceId: input.ticketId,
    });
  }
  if (await currentCheckinId(tx, input.tenantId, input.ticketId)) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.ALREADY_CHECKED_IN,
      message: 'Ticket already has a current check-in',
      resourceType: 'ticket',
      resourceId: input.ticketId,
    });
  }
  await expireHeld(tx, input.tenantId, input.ticketId);
  const held = await currentHold(tx, input.tenantId, input.ticketId);
  if (held && held.staff_session_id !== input.staffSessionId) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.HELD_BY_OTHER_SESSION,
      message: 'Ticket is held by another staff session',
      resourceType: 'ticket',
      resourceId: input.ticketId,
    });
  }

  const token = newToken();
  const hash = tokenHash(token);
  if (held) {
    await tx.$executeRaw`
      UPDATE checkin_reservations
      SET token_hash = ${hash},
          expires_at = clock_timestamp() + interval '30 seconds'
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${held.id}::uuid
    `;
    const refreshed = await tx.$queryRaw<Array<{ expires_at: Date }>>`
      SELECT expires_at FROM checkin_reservations
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${held.id}::uuid
    `;
    const expiresAt = refreshed[0]?.expires_at;
    if (!expiresAt) {
      throw new GateError(
        GATE_ERROR_CODES.RESERVATION_NOT_FOUND,
        'Reservation disappeared while refreshing the hold',
      );
    }
    return {
      ok: true,
      reservationId: held.id,
      token,
      expiresAt,
      ticketId: input.ticketId,
    };
  }

  const reservationId = randomUUID();
  const inserted = await tx.$queryRaw<Array<{ expires_at: Date }>>`
    INSERT INTO checkin_reservations (
      tenant_id, event_id, id, ticket_id, staff_session_id, token_hash, status, expires_at
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${reservationId}::uuid,
      ${input.ticketId}::uuid,
      ${input.staffSessionId}::uuid,
      ${hash},
      'HELD',
      clock_timestamp() + interval '30 seconds'
    )
    RETURNING expires_at
  `;
  const expiresAt = inserted[0]?.expires_at;
  if (!expiresAt) {
    throw new GateError(
      GATE_ERROR_CODES.RESERVATION_NOT_FOUND,
      'Reservation was not inserted',
    );
  }
  return {
    ok: true,
    reservationId,
    token,
    expiresAt,
    ticketId: input.ticketId,
  };
}

export async function confirmCheckin(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    reservationId: string;
    token: string;
    staffSessionId: string;
    actorUserId: string;
  },
): Promise<ConfirmOutcome> {
  const __confirmStart = process.hrtime.bigint();
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIRM,
    eventId: input.eventId,
  });
  await assertOpenForGate(tx, input.tenantId, input.eventId);
  await assertSessionActive(
    tx,
    input.tenantId,
    input.eventId,
    input.staffSessionId,
    input.actorUserId,
  );

  const peeked = await tx.$queryRaw<
    Array<{ ticket_id: string; event_id: string }>
  >`
    SELECT ticket_id, event_id
    FROM checkin_reservations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.reservationId}::uuid
  `;
  const peekedRow = peeked[0];
  if (!peekedRow || peekedRow.event_id !== input.eventId) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.RESERVATION_NOT_FOUND,
      message: 'Reservation not found',
      resourceType: 'checkin_reservation',
      resourceId: input.reservationId,
    });
  }
  const ticket = await lockTicket(
    tx,
    input.tenantId,
    input.eventId,
    peekedRow.ticket_id,
  );
  const reservations = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM checkin_reservations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${input.reservationId}::uuid
      AND ticket_id = ${ticket.id}::uuid
    FOR UPDATE
  `;
  const reservationRow = reservations[0];
  if (!reservationRow) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.RESERVATION_NOT_FOUND,
      message: 'Reservation not found',
      resourceType: 'ticket',
      resourceId: ticket.id,
    });
  }
  const reservation = { id: reservationRow.id, ticket_id: ticket.id };
  const decision = await tx.$queryRaw<
    Array<{ status: string; live: boolean; staff_session_id: string; token_hash: string }>
  >`
    SELECT status,
           expires_at > clock_timestamp() AS live,
           staff_session_id,
           token_hash
    FROM checkin_reservations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND id = ${reservation.id}::uuid
  `;
  const now = decision[0];
  if (!now || now.status !== 'HELD' || !now.live) {
    if (now?.status === 'HELD') {
      await tx.$executeRaw`
        UPDATE checkin_reservations
        SET status = 'EXPIRED'
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${reservation.id}::uuid
          AND status = 'HELD'
      `;
    }
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code:
        now?.status === 'CONFIRMED'
          ? GATE_ERROR_CODES.ALREADY_CHECKED_IN
          : GATE_ERROR_CODES.RESERVATION_EXPIRED,
      message: 'Reservation is not a live hold',
      resourceType: 'ticket',
      resourceId: reservation.ticket_id,
    });
  }
  if (now.staff_session_id !== input.staffSessionId) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.HELD_BY_OTHER_SESSION,
      message: 'Reservation belongs to another session',
      resourceType: 'ticket',
      resourceId: reservation.ticket_id,
    });
  }
  if (now.token_hash !== tokenHash(input.token)) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.RESERVATION_TOKEN_MISMATCH,
      message: 'Reservation token does not match',
      resourceType: 'ticket',
      resourceId: reservation.ticket_id,
    });
  }
  if (ticket.state !== 'ACTIVE') {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.TICKET_NOT_ACTIVE,
      message: 'Ticket is not active',
      resourceType: 'ticket',
      resourceId: reservation.ticket_id,
    });
  }
  if (await currentCheckinId(tx, input.tenantId, reservation.ticket_id)) {
    return denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.ALREADY_CHECKED_IN,
      message: 'Ticket already has a current check-in',
      resourceType: 'ticket',
      resourceId: reservation.ticket_id,
    });
  }

  const checkinId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO checkins (
      tenant_id, event_id, id, ticket_id, reservation_id, staff_session_id, actor_user_id
    ) VALUES (
      ${input.tenantId}::uuid,
      ${input.eventId}::uuid,
      ${checkinId}::uuid,
      ${reservation.ticket_id}::uuid,
      ${reservation.id}::uuid,
      ${input.staffSessionId}::uuid,
      ${input.actorUserId}::uuid
    )
  `;
  await tx.$executeRaw`
    UPDATE checkin_reservations
    SET status = 'CONFIRMED'
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${reservation.id}::uuid
  `;
  await tx.$executeRaw`
    UPDATE tickets
    SET state = 'USED', updated_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${reservation.ticket_id}::uuid
  `;
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'gate.confirm',
    resourceType: 'checkin',
    resourceId: checkinId,
  });
  metricsInc('gate_confirm_total', { result: 'ok' });
  metricsObserveSeconds('gate_confirm_seconds', Number(process.hrtime.bigint() - __confirmStart) / 1e9, {});
  return {
    ok: true,
    checkinId,
    ticketId: reservation.ticket_id,
    reservationId: reservation.id,
    state: 'USED',
  };
}

export async function undoCheckin(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    checkinId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<UndoResult> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new GateError(GATE_ERROR_CODES.CHECKIN_NOT_FOUND, 'Undo reason is required');
  }
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_UNDO,
    eventId: input.eventId,
  });
  const rows = await tx.$queryRaw<
    Array<{ id: string; ticket_id: string; undone_at: Date | null }>
  >`
    SELECT id, ticket_id, undone_at
    FROM checkins
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.checkinId}::uuid
    FOR UPDATE
  `;
  const checkin = rows[0];
  if (!checkin) {
    throw new GateError(GATE_ERROR_CODES.CHECKIN_NOT_FOUND, 'Check-in not found');
  }
  if (checkin.undone_at) {
    throw new GateError(
      GATE_ERROR_CODES.CHECKIN_ALREADY_UNDONE,
      'Check-in was already undone',
    );
  }
  await lockTicket(tx, input.tenantId, input.eventId, checkin.ticket_id);
  await tx.$executeRaw`
    UPDATE checkins
    SET undone_at = clock_timestamp(),
        undo_reason = ${reason},
        undone_by = ${input.actorUserId}::uuid
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${checkin.id}::uuid
  `;
  await tx.$executeRaw`
    UPDATE tickets
    SET state = 'ACTIVE', updated_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${checkin.ticket_id}::uuid
      AND state = 'USED'
  `;
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'gate.undo',
    resourceType: 'checkin',
    resourceId: checkin.id,
    reason,
  });
  metricsInc('gate_recovery_total', { kind: 'undo' });
  return { checkinId: checkin.id, ticketId: checkin.ticket_id, state: 'ACTIVE' };
}

export async function revokeTicket(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    ticketId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<void> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_REVOKE,
    eventId: input.eventId,
  });
  const ticket = await lockTicket(
    tx,
    input.tenantId,
    input.eventId,
    input.ticketId,
  );
  if (ticket.state === 'REVOKED') return;
  await tx.$executeRaw`
    UPDATE tickets
    SET state = 'REVOKED', updated_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${ticket.id}::uuid
  `;
  await tx.$executeRaw`
    UPDATE checkin_reservations
    SET status = 'RELEASED'
    WHERE tenant_id = ${input.tenantId}::uuid
      AND ticket_id = ${ticket.id}::uuid
      AND status = 'HELD'
  `;
  await tx.$executeRaw`
    UPDATE ticket_credentials
    SET status = 'REVOKED'
    WHERE tenant_id = ${input.tenantId}::uuid AND ticket_id = ${ticket.id}::uuid
  `;
  await writeAudit(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    action: 'ticket.revoke',
    resourceType: 'ticket',
    resourceId: ticket.id,
    reason: input.reason,
  });
}

/**
 * Ticket reissue (DB-09 handoff §4) — mint the next `ticket_credentials`
 * version, invalidate the current one, bump `tickets.credential_version` so
 * the next outbox email picks up the new QR. Supervisor/Owner only
 * (`ticket.reissue`), reason mandatory, no rate limit (rare, audited action).
 * Not blocked by a HELD reservation and not blocked by a cancelled event —
 * same precedent as `revokeTicket`. Response never carries the raw token;
 * the new QR reaches the owner only via the existing TicketIssued email
 * outbox path (see TICKET-REISSUE-HANDOFF.md §8).
 */
export async function reissueTicketCredential(
  tx: Prisma.TransactionClient,
  credentialKeyMaterial: string,
  input: {
    tenantId: string;
    eventId: string;
    ticketId: string;
    actorUserId: string;
    reason: string;
    idempotencyKey: string | undefined;
  },
): Promise<ReissueOutcome> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new GateError(
      GATE_ERROR_CODES.REASON_REQUIRED,
      'Reissue reason is required',
    );
  }

  const { membership } = await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_REISSUE,
    eventId: input.eventId,
  });
  if (membership.role !== 'Owner' && membership.role !== 'Supervisor') {
    throw new AuthzError(
      AUTHZ_ERROR_CODES.PERMISSION_DENIED,
      'Ticket reissue requires Owner or Supervisor role',
    );
  }

  const clientKey = requireIdempotencyKey(input.idempotencyKey);
  const requestHash = canonicalHash({
    command: REISSUE_COMMAND,
    tenantId: input.tenantId,
    eventId: input.eventId,
    ticketId: input.ticketId,
    reason,
  });
  const { op, claimed } = await claimOperation(tx, {
    tenantId: input.tenantId,
    eventId: input.eventId,
    actorUserId: input.actorUserId,
    command: REISSUE_COMMAND,
    clientKey,
    requestHash,
  });
  if (!claimed) {
    const saved = (op.response_json ?? {}) as ReissueOutcome;
    if (saved.ok === true) {
      return { ...saved, replayed: true };
    }
    return saved;
  }

  let ticket: TicketLock;
  try {
    ticket = await lockTicket(
      tx,
      input.tenantId,
      input.eventId,
      input.ticketId,
    );
  } catch (err) {
    if (
      err instanceof GateError &&
      err.code === GATE_ERROR_CODES.TICKET_NOT_FOUND
    ) {
      const outcome = await denyGate(tx, {
        tenantId: input.tenantId,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        code: GATE_ERROR_CODES.TICKET_NOT_FOUND,
        message: err.message,
        resourceType: 'ticket',
        resourceId: input.ticketId,
      });
      await completeOperation(tx, input.tenantId, op.id, outcome);
      return outcome;
    }
    throw err;
  }

  if (ticket.state !== 'ACTIVE') {
    const outcome = await denyGate(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      code: GATE_ERROR_CODES.TICKET_NOT_ACTIVE,
      message: 'Ticket is not active',
      resourceType: 'ticket',
      resourceId: ticket.id,
    });
    await completeOperation(tx, input.tenantId, op.id, outcome);
    return outcome;
  }

  const fromVersion = ticket.credential_version;
  const newVersion = fromVersion + 1;
  const rawToken = randomBytes(32).toString('base64url');
  const sealed = sealCredentialToken(rawToken, credentialKeyMaterial);

  // Invalidate the current credential before minting the next version so
  // the partial unique index (tenant_id, ticket_id) WHERE status='ACTIVE'
  // never sees two ACTIVE rows for this ticket, even momentarily.
  await tx.$executeRaw`
    UPDATE ticket_credentials
    SET status = 'REVOKED'
    WHERE tenant_id = ${input.tenantId}::uuid
      AND ticket_id = ${ticket.id}::uuid
      AND status = 'ACTIVE'
  `;
  await tx.$executeRaw`
    INSERT INTO ticket_credentials (
      tenant_id, ticket_id, version, kid, token_hash, encrypted_token,
      status, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${ticket.id}::uuid, ${newVersion}::integer,
      ${sealed.kid}, ${sealed.tokenHash}, ${sealed.encryptedToken},
      'ACTIVE', now()
    )
  `;
  await tx.$executeRaw`
    UPDATE tickets
    SET credential_version = ${newVersion}::integer, updated_at = clock_timestamp()
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${ticket.id}::uuid
  `;

  const auditId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, reason, sanitized_diff, operation_id, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${auditId}::uuid,
      ${input.actorUserId}::uuid, 'ticket.credential_reissue', 'ticket',
      ${ticket.id}::uuid, ${reason},
      ${JSON.stringify({ fromVersion, toVersion: newVersion })}::jsonb,
      ${op.id}::uuid, now()
    )
  `;

  // Reuse the TicketIssued outbox/notification path (cs.ts resend pattern):
  // the worker re-reads tickets.credential_version and renders whatever is
  // current, so no new outbox type or notification kind is needed. Owner
  // email must be carried in the payload — the worker's send step reads
  // `payload.email` directly and does not look the owner up itself.
  const owners = await tx.$queryRaw<
    Array<{ owner_user_id: string; email: string | null }>
  >`
    SELECT t.owner_user_id, u.email
    FROM tickets t
    JOIN users u ON u.id = t.owner_user_id
    WHERE t.tenant_id = ${input.tenantId}::uuid AND t.id = ${ticket.id}::uuid
  `;
  const owner = owners[0];
  const outboxId = randomUUID();
  const notificationId = randomUUID();
  const businessKey = `ticket:${ticket.id}:reissue:email:${op.id}`;
  const notifyPayload = {
    ticketId: ticket.id,
    requestId: op.id,
    email: owner?.email ?? null,
    eventId: input.eventId,
    ownerUserId: owner?.owner_user_id,
    businessKey,
  };
  await tx.$executeRaw`
    INSERT INTO outbox (
      tenant_id, event_id, id, type, aggregate_id, payload_version,
      payload, status, attempts, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${outboxId}::uuid,
      'TicketIssued', ${ticket.id}::uuid, 1,
      ${JSON.stringify(notifyPayload)}::jsonb, 'PENDING', 0, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO notifications (
      tenant_id, event_id, id, business_key, channel, state,
      attempts, payload, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${notificationId}::uuid,
      ${businessKey}, 'email', 'PENDING', 0,
      ${JSON.stringify(notifyPayload)}::jsonb, now(), now()
    )
  `;

  const outcome: ReissueOutcome = {
    ok: true,
    ticketId: ticket.id,
    credentialVersion: newVersion,
    replayed: false,
  };
  await completeOperation(tx, input.tenantId, op.id, outcome);
  metricsInc('gate_reissue_total', { result: 'ok' });
  return outcome;
}

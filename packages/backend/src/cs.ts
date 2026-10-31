import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import { CsError, CS_ERROR_CODES } from './cs-error';
import { hashRedemptionCode, type CodeHmacConfig } from './code-hmac';
import {
  maskEmail,
  providerStatusFromDbState,
  type ProviderStatus,
} from './notification-status';
import {
  assertTenantAllowsAdminMutation,
  lockTenantPolicyForShare,
} from './tenant-policy';

const PERMISSION_LOOKUP = 'cs.lookup';
const PERMISSION_RESEND = 'cs.resend';
const RESEND_COMMAND = 'cs.resend';
const MAX_Q = 128;
const MAX_LIMIT = 50;
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_LIMIT_PER_HOUR = 10;

export type CsNotificationSummary = {
  channel: string;
  state: string;
  providerStatus: ProviderStatus;
  providerRef: string | null;
  attempts: number;
  lastError: null;
};

export type CsTicketSummary = {
  ticketId: string;
  state: string;
  ticketTypeId: string;
  sourceId: string;
  createdAt: string;
  ownerEmailMasked: string | null;
  lastCheckInAt: string | null;
  notification: CsNotificationSummary | null;
};

export type CsTimelineItem = {
  at: string;
  kind: string;
  summary: string;
};

export type CsTicketDetail = CsTicketSummary & {
  timeline: CsTimelineItem[];
};

type TicketRow = {
  id: string;
  state: string;
  ticket_type_id: string;
  source_id: string;
  created_at: Date;
  owner_user_id: string;
  email: string | null;
};
type TicketListRow = TicketRow & { cursor_created_at: string };

// Cursor timestamps come from PostgreSQL text; a JS Date would drop microseconds.
function encodeCursor(createdAt: string, ticketId: string): string {
  return Buffer.from(`v1|${createdAt}|${ticketId}`, 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(
  cursor: string | undefined,
): { createdAt: string; ticketId: string; legacy: boolean } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parts = raw.split('|');
    if (parts[0] === 'v1') {
      const [, createdAt, ticketId] = parts;
      if (
        parts.length !== 3 ||
        !createdAt ||
        !ticketId ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(createdAt) ||
        Number.isNaN(Date.parse(createdAt))
      )
        return null;
      return { createdAt, ticketId, legacy: false };
    }
    const [iso, ticketId] = parts;
    if (!iso || !ticketId) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt: createdAt.toISOString(), ticketId, legacy: true };
  } catch {
    return null;
  }
}

async function mapNotification(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<CsNotificationSummary | null> {
  const rows = await tx.$queryRaw<
    {
      channel: string;
      state: string;
      provider_ref: string | null;
      attempts: number;
    }[]
  >`
    SELECT channel, state, provider_ref, attempts
    FROM notifications
    WHERE tenant_id = ${tenantId}::uuid
      AND business_key LIKE ${'ticket:' + ticketId + ':%'}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const n = rows[0];
  if (!n) return null;
  return {
    channel: n.channel,
    state: n.state,
    providerStatus: providerStatusFromDbState(n.state),
    providerRef: n.provider_ref,
    attempts: n.attempts,
    lastError: null,
  };
}

async function lastCheckIn(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ confirmed_at: Date }[]>`
    SELECT confirmed_at
    FROM checkins
    WHERE tenant_id = ${tenantId}::uuid
      AND ticket_id = ${ticketId}::uuid
      AND undone_at IS NULL
    ORDER BY confirmed_at DESC
    LIMIT 1
  `;
  return rows[0]?.confirmed_at?.toISOString() ?? null;
}

async function toSummary(
  tx: Prisma.TransactionClient,
  tenantId: string,
  row: TicketRow,
): Promise<CsTicketSummary> {
  return {
    ticketId: row.id,
    state: row.state,
    ticketTypeId: row.ticket_type_id,
    sourceId: row.source_id,
    createdAt: row.created_at.toISOString(),
    ownerEmailMasked: maskEmail(row.email),
    lastCheckInAt: await lastCheckIn(tx, tenantId, row.id),
    notification: await mapNotification(tx, tenantId, row.id),
  };
}

export async function listCsTickets(
  tx: Prisma.TransactionClient,
  hmac: CodeHmacConfig,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    q?: string;
    limit?: number;
    cursor?: string;
  },
): Promise<{ items: CsTicketSummary[]; nextCursor: string | null }> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_LOOKUP,
    eventId: input.eventId,
  });

  const events = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM events
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${input.eventId}::uuid
  `;
  if (!events[0]) {
    throw new CsError(CS_ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
  }

  const q = (input.q ?? '').trim();
  if (q.length > MAX_Q) {
    throw new CsError(CS_ERROR_CODES.QUERY_TOO_LONG, 'Query too long');
  }
  const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_LIMIT);
  const cursor = decodeCursor(input.cursor);

  let rows: TicketListRow[];

  if (q && /^[0-9a-f-]{36}$/i.test(q)) {
    rows = await tx.$queryRaw<TicketListRow[]>`
      SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
             to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
             t.owner_user_id, u.email
      FROM tickets t
      LEFT JOIN users u ON u.id = t.owner_user_id
      WHERE t.tenant_id = ${input.tenantId}::uuid
        AND t.event_id = ${input.eventId}::uuid
        AND t.id = ${q}::uuid
      LIMIT ${limit + 1}
    `;
  } else if (q.includes('@')) {
    rows = await tx.$queryRaw<TicketListRow[]>`
      SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
             to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
             t.owner_user_id, u.email
      FROM tickets t
      JOIN users u ON u.id = t.owner_user_id
      WHERE t.tenant_id = ${input.tenantId}::uuid
        AND t.event_id = ${input.eventId}::uuid
        AND lower(u.email) = lower(${q})
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit + 1}
    `;
  } else if (q.length >= 4) {
    const codeHmac = hashRedemptionCode(hmac, q);
    rows = await tx.$queryRaw<TicketListRow[]>`
      SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
             to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
             t.owner_user_id, u.email
      FROM tickets t
      LEFT JOIN users u ON u.id = t.owner_user_id
      JOIN redemption_codes rc
        ON rc.tenant_id = t.tenant_id
       AND rc.id = t.redemption_code_id
      WHERE t.tenant_id = ${input.tenantId}::uuid
        AND t.event_id = ${input.eventId}::uuid
        AND rc.code_hmac = ${codeHmac}
      LIMIT ${limit + 1}
    `;
    if (rows.length === 0) {
      rows = await tx.$queryRaw<TicketListRow[]>`
        SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
               to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
               t.owner_user_id, u.email
        FROM tickets t
        JOIN users u ON u.id = t.owner_user_id
        WHERE t.tenant_id = ${input.tenantId}::uuid
          AND t.event_id = ${input.eventId}::uuid
          AND u.email ILIKE ${'%' + q.replace(/[%_]/g, '') + '%'}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${limit + 1}
      `;
    }
  } else if (cursor) {
    rows = await tx.$queryRaw<TicketListRow[]>`
      SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
             to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
             t.owner_user_id, u.email
      FROM tickets t
      LEFT JOIN users u ON u.id = t.owner_user_id
      WHERE t.tenant_id = ${input.tenantId}::uuid
        AND t.event_id = ${input.eventId}::uuid
        AND (t.created_at, t.id) < (
          COALESCE(
            -- Legacy cursors lost microseconds; recover the anchor within this scope.
            (SELECT anchor.created_at FROM tickets anchor
             WHERE ${cursor.legacy} AND anchor.tenant_id = ${input.tenantId}::uuid
               AND anchor.event_id = ${input.eventId}::uuid
               AND anchor.id = ${cursor.ticketId}::uuid),
            ${cursor.createdAt}::timestamptz
          ), ${cursor.ticketId}::uuid)
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit + 1}
    `;
  } else {
    rows = await tx.$queryRaw<TicketListRow[]>`
      SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
             to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
             t.owner_user_id, u.email
      FROM tickets t
      LEFT JOIN users u ON u.id = t.owner_user_id
      WHERE t.tenant_id = ${input.tenantId}::uuid
        AND t.event_id = ${input.eventId}::uuid
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit + 1}
    `;
  }

  const page = rows.slice(0, limit);
  const items = [];
  for (const row of page) items.push(await toSummary(tx, input.tenantId, row));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor(last.cursor_created_at, last.id)
      : null;
  return { items, nextCursor };
}

export async function getCsTicket(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    ticketId: string;
  },
): Promise<CsTicketDetail> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_LOOKUP,
    eventId: input.eventId,
  });

  const rows = await tx.$queryRaw<TicketRow[]>`
    SELECT t.id, t.state, t.ticket_type_id, t.source_id, t.created_at,
           t.owner_user_id, u.email
    FROM tickets t
    LEFT JOIN users u ON u.id = t.owner_user_id
    WHERE t.tenant_id = ${input.tenantId}::uuid
      AND t.event_id = ${input.eventId}::uuid
      AND t.id = ${input.ticketId}::uuid
  `;
  const row = rows[0];
  if (!row) {
    throw new CsError(CS_ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
  }

  const summary = await toSummary(tx, input.tenantId, row);
  const audits = await tx.$queryRaw<
    { created_at: Date; action: string; resource_type: string }[]
  >`
    SELECT created_at, action, resource_type
    FROM audit_logs
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND resource_id = ${input.ticketId}::uuid
    ORDER BY created_at ASC
    LIMIT 100
  `;
  const notes = await tx.$queryRaw<
    { created_at: Date; state: string; channel: string }[]
  >`
    SELECT created_at, state, channel
    FROM notifications
    WHERE tenant_id = ${input.tenantId}::uuid
      AND business_key LIKE ${'ticket:' + input.ticketId + ':%'}
    ORDER BY created_at ASC
    LIMIT 50
  `;
  const checkins = await tx.$queryRaw<
    { confirmed_at: Date; undone_at: Date | null }[]
  >`
    SELECT confirmed_at, undone_at
    FROM checkins
    WHERE tenant_id = ${input.tenantId}::uuid
      AND ticket_id = ${input.ticketId}::uuid
    ORDER BY confirmed_at ASC
    LIMIT 50
  `;

  const timeline: CsTimelineItem[] = [];
  for (const a of audits) {
    timeline.push({
      at: a.created_at.toISOString(),
      kind: a.action,
      summary: `${a.resource_type}:${a.action}`,
    });
  }
  for (const n of notes) {
    timeline.push({
      at: n.created_at.toISOString(),
      kind: `notification.${n.channel}`,
      summary: `notification ${providerStatusFromDbState(n.state)}`,
    });
  }
  for (const c of checkins) {
    timeline.push({
      at: c.confirmed_at.toISOString(),
      kind: 'checkin.confirmed',
      summary: 'check-in confirmed',
    });
    if (c.undone_at) {
      timeline.push({
        at: c.undone_at.toISOString(),
        kind: 'checkin.undone',
        summary: 'check-in undone',
      });
    }
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return { ...summary, timeline };
}

export async function resendTicketEmail(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    ticketId: string;
    clientKey: string;
  },
): Promise<{
  operationId: string;
  notificationId: string;
  providerStatus: 'PENDING';
  replayed: boolean;
}> {
  if (!input.clientKey?.trim()) {
    throw new CsError(
      CS_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key required',
    );
  }

  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_RESEND,
    eventId: input.eventId,
  });
  const policy = await lockTenantPolicyForShare(tx, input.tenantId);
  assertTenantAllowsAdminMutation(policy.status);

  const existing = await tx.$queryRaw<
    { id: string; status: string; response_json: Prisma.JsonValue }[]
  >`
    SELECT id, status, response_json
    FROM operations
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND command = ${RESEND_COMMAND}
      AND client_key = ${input.clientKey}
    FOR UPDATE
  `;
  if (existing[0]) {
    const body = (existing[0].response_json ?? {}) as {
      operationId?: string;
      notificationId?: string;
      providerStatus?: 'PENDING';
    };
    if (
      existing[0].status === 'COMPLETED' &&
      body.operationId &&
      body.notificationId
    ) {
      return {
        operationId: body.operationId,
        notificationId: body.notificationId,
        providerStatus: 'PENDING',
        replayed: true,
      };
    }
    throw new CsError(
      CS_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency conflict',
    );
  }

  // Serialize the staff hourly count across different ticket row locks.
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('cs_resend_staff'),
      hashtext(${input.tenantId} || ':' || ${input.actorUserId})
    )
  `;

  const tickets = await tx.$queryRaw<{ id: string; owner_user_id: string }[]>`
    SELECT t.id, t.owner_user_id
    FROM tickets t
    WHERE t.tenant_id = ${input.tenantId}::uuid
      AND t.event_id = ${input.eventId}::uuid
      AND t.id = ${input.ticketId}::uuid
    FOR UPDATE
  `;
  const locked = tickets[0];
  if (!locked) {
    throw new CsError(CS_ERROR_CODES.TICKET_NOT_FOUND, 'Ticket not found');
  }
  const emails = await tx.$queryRaw<{ email: string | null }[]>`
    SELECT email FROM users WHERE id = ${locked.owner_user_id}::uuid
  `;
  const ticket = {
    id: locked.id,
    owner_user_id: locked.owner_user_id,
    email: emails[0]?.email ?? null,
  };

  const recent = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM audit_logs
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND resource_id = ${input.ticketId}::uuid
      AND action = 'ticket.email_resend'
      AND created_at > now() - make_interval(secs => ${RESEND_COOLDOWN_SECONDS})
  `;
  if ((recent[0]?.n ?? 0) > 0) {
    throw new CsError(CS_ERROR_CODES.RESEND_COOLDOWN, 'Resend cooldown active');
  }

  const hourly = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM audit_logs
    WHERE tenant_id = ${input.tenantId}::uuid
      AND actor_user_id = ${input.actorUserId}::uuid
      AND action = 'ticket.email_resend'
      AND created_at > now() - interval '1 hour'
  `;
  if ((hourly[0]?.n ?? 0) >= RESEND_LIMIT_PER_HOUR) {
    throw new CsError(CS_ERROR_CODES.RESEND_LIMIT, 'Resend limit reached');
  }

  const operationId = randomUUID();
  const notificationId = randomUUID();
  const outboxId = randomUUID();
  const auditId = randomUUID();
  const businessKey = `ticket:${input.ticketId}:resend:email:${operationId}`;
  const payload = {
    ticketId: input.ticketId,
    requestId: operationId,
    email: ticket.email,
    eventId: input.eventId,
    ownerUserId: ticket.owner_user_id,
    businessKey,
  };

  const requestHash = createHash('sha256')
    .update(`resend:${input.ticketId}`)
    .digest('hex');
  await tx.$executeRaw`
    INSERT INTO operations (
      tenant_id, event_id, id, actor_user_id, command, client_key,
      request_hash, status, response_json, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
      ${input.actorUserId}::uuid, ${RESEND_COMMAND}, ${input.clientKey},
      ${requestHash}, 'COMPLETED',
      ${JSON.stringify({
        operationId,
        notificationId,
        providerStatus: 'PENDING',
      })}::jsonb,
      now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO outbox (
      tenant_id, event_id, id, type, aggregate_id, payload_version,
      payload, status, attempts, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${outboxId}::uuid,
      'TicketIssued', ${input.ticketId}::uuid, 1,
      ${JSON.stringify(payload)}::jsonb, 'PENDING', 0, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO notifications (
      tenant_id, event_id, id, business_key, channel, state,
      attempts, payload, created_at, updated_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${notificationId}::uuid,
      ${businessKey}, 'email', 'PENDING', 0,
      ${JSON.stringify(payload)}::jsonb, now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO audit_logs (
      tenant_id, event_id, id, actor_user_id, action, resource_type,
      resource_id, sanitized_diff, operation_id, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.eventId}::uuid, ${auditId}::uuid,
      ${input.actorUserId}::uuid, 'ticket.email_resend', 'ticket',
      ${input.ticketId}::uuid,
      ${JSON.stringify({ notificationId })}::jsonb,
      ${operationId}::uuid, now()
    )
  `;

  return {
    operationId,
    notificationId,
    providerStatus: 'PENDING',
    replayed: false,
  };
}

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect } from 'playwright/test';
import type { CaseFixture } from '../harness/contract';

// Resolve pg from the backend workspace; the e2e directory is not a package.
const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

type Row = Record<string, unknown>;
export type RedemptionState = {
  code: Row;
  requests: Row[];
  tickets: Row[];
  operations: Row[];
  quotas: Row[];
  outbox: Row[];
};

export function codeIdFor(fixture: CaseFixture, name = 'primary'): string {
  const id = (fixture.data?.codeIds as Record<string, string> | undefined)?.[
    name
  ];
  if (!id)
    throw new Error(
      `BLOCKED: missing ${name} code ID for PostgreSQL assertion`,
    );
  return id;
}

export async function readEventQuotas(fixture: CaseFixture): Promise<Row[]> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const rows = await client.query(
      'SELECT id, scope, scope_id, capacity, allocated FROM quota_buckets WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY scope, id',
      [fixture.tenantId, fixture.eventId],
    );
    await client.query('COMMIT');
    return rows.rows as Row[];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/** Manual redeem: locate HELD code + PENDING_REVIEW request for the actor on the fixture event. */
export async function readManualPendingHold(
  fixture: CaseFixture,
  actorUserId: string,
): Promise<{ code: Row; request: Row }> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const pending = await client.query(
      `SELECT id, status, actor_user_id, redemption_code_id
       FROM redemption_requests
       WHERE tenant_id=$1::uuid
         AND event_id=$2::uuid
         AND actor_user_id=$3::uuid
         AND status = 'PENDING_REVIEW'
       ORDER BY created_at DESC
       LIMIT 1`,
      [fixture.tenantId, fixture.eventId, actorUserId],
    );
    await client.query('COMMIT');
    expect(pending.rows).toHaveLength(1);
    const request = pending.rows[0] as Row;
    const codeId = String(request.redemption_code_id);
    const state = await readRedemptionState(fixture, codeId);
    expect(state.tickets).toHaveLength(0);
    return { code: state.code, request };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export async function expirePendingRedemptionRequest(
  fixture: CaseFixture,
  requestId: string,
): Promise<void> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: expire pending requires isolated PostgreSQL runtime',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const updated = await client.query(
      "UPDATE redemption_requests SET expires_at = now() - interval '1 hour' WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='PENDING_REVIEW' RETURNING id",
      [fixture.tenantId, requestId],
    );
    expect(updated.rowCount).toBe(1);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export function assertManualIssuedAfterApproval(
  quotasBefore: Row[],
  after: RedemptionState,
  fixture: CaseFixture,
  actorUserId: string,
  ticketId: string,
): void {
  expect(after.code.status).toBe('CONSUMED');
  expect(after.requests).toHaveLength(1);
  expect(after.requests[0].status).toBe('ISSUED');
  expect(after.requests[0].actor_user_id).toBe(actorUserId);
  expect(after.tickets).toHaveLength(1);
  expect(after.tickets[0].id).toBe(ticketId);
  expect(after.tickets[0].owner_user_id).toBe(actorUserId);
  expect(after.tickets[0].state).toBe('ACTIVE');
  expect(after.outbox).toHaveLength(1);
  for (let i = 0; i < after.quotas.length; i++) {
    expect(
      Number(after.quotas[i].allocated) - Number(quotasBefore[i].allocated),
    ).toBe(1);
  }
}

export function assertManualDecisionWithoutTicket(
  after: RedemptionState,
  requestStatus: 'REJECTED' | 'EXPIRED',
  quotasBefore: Row[],
): void {
  expect(after.requests).toHaveLength(1);
  expect(after.requests[0].status).toBe(requestStatus);
  expect(after.tickets).toHaveLength(0);
  expect(after.outbox).toHaveLength(0);
  expect(after.quotas).toEqual(quotasBefore);
  expect(after.requests.some((row) => row.status === 'ISSUED')).toBe(false);
}

/** Read the run-local database as e2e_runtime under transaction-local tenant RLS. */
export async function readRedemptionState(
  fixture: CaseFixture,
  codeId: string,
): Promise<RedemptionState> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const query = async (sql: string, values: string[]) =>
      (await client.query(sql, values)).rows as Row[];
    const code = await query(
      'SELECT id, event_id, source_id, ticket_type_id, status, active_request_id FROM redemption_codes WHERE tenant_id=$1::uuid AND id=$2::uuid',
      [fixture.tenantId, codeId],
    );
    const requests = await query(
      'SELECT id, status, actor_user_id, redemption_code_id FROM redemption_requests WHERE tenant_id=$1::uuid AND redemption_code_id=$2::uuid',
      [fixture.tenantId, codeId],
    );
    const tickets = await query(
      'SELECT id, event_id, owner_user_id, ticket_type_id, source_id, request_id, redemption_code_id, state FROM tickets WHERE tenant_id=$1::uuid AND redemption_code_id=$2::uuid',
      [fixture.tenantId, codeId],
    );
    const operations = await query(
      "SELECT id, actor_user_id, client_key, status, response_json FROM operations WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND command='redemption.redeem'",
      [fixture.tenantId, fixture.eventId],
    );
    const quotas = await query(
      'SELECT id, scope, scope_id, capacity, allocated FROM quota_buckets WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY scope, id',
      [fixture.tenantId, fixture.eventId],
    );
    const outbox = tickets.length
      ? await query(
          "SELECT id, aggregate_id, type, status FROM outbox WHERE tenant_id=$1::uuid AND aggregate_id=$2::uuid AND type='TicketIssued'",
          [fixture.tenantId, String(tickets[0].id)],
        )
      : [];
    await client.query('COMMIT');
    expect(code).toHaveLength(1);
    return { code: code[0], requests, tickets, operations, quotas, outbox };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export function assertIssuedExactlyOnce(
  before: RedemptionState,
  after: RedemptionState,
  fixture: CaseFixture,
  actorUserId: string,
  ticketId?: string,
): string {
  expect(before.code.status).toBe('AVAILABLE');
  expect(before.requests).toHaveLength(0);
  expect(before.tickets).toHaveLength(0);
  expect(after.code.status).toBe('CONSUMED');
  expect(after.requests).toHaveLength(1);
  expect(after.requests[0].status).toBe('ISSUED');
  expect(after.requests[0].actor_user_id).toBe(actorUserId);
  expect(after.code.active_request_id).toBe(after.requests[0].id);
  expect(after.tickets).toHaveLength(1);
  const ticket = after.tickets[0];
  expect(ticket.id).toMatch(/^[0-9a-f-]{36}$/i);
  if (ticketId) expect(ticket.id).toBe(ticketId);
  expect(ticket.request_id).toBe(after.requests[0].id);
  expect(ticket.event_id).toBe(fixture.eventId);
  expect(ticket.owner_user_id).toBe(actorUserId);
  expect(ticket.ticket_type_id).toBe(fixture.ticketTypeId);
  expect(ticket.source_id).toBe(fixture.sourceId);
  expect(ticket.state).toBe('ACTIVE');
  const successful = after.operations.filter(
    (row) =>
      (row.response_json as { ticketId?: string } | null)?.ticketId ===
      ticket.id,
  );
  expect(successful).toHaveLength(1);
  expect(successful[0].status).toBe('COMPLETED');
  expect(successful[0].actor_user_id).toBe(actorUserId);
  expect(after.outbox).toHaveLength(1);
  expect(after.outbox[0].aggregate_id).toBe(ticket.id);
  expect(after.quotas.length).toBeGreaterThan(0);
  expect(after.quotas.map((row) => row.id)).toEqual(
    before.quotas.map((row) => row.id),
  );
  for (let i = 0; i < after.quotas.length; i++) {
    expect(
      Number(after.quotas[i].allocated) - Number(before.quotas[i].allocated),
    ).toBe(1);
    if (after.quotas[i].capacity !== null)
      expect(Number(after.quotas[i].allocated)).toBeLessThanOrEqual(
        Number(after.quotas[i].capacity),
      );
  }
  return String(ticket.id);
}

/** Event-scoped snapshot for WEB-04 negative browser paths (ticket count, codes, quota, ops). */
export type Web04EventSnapshot = {
  ticketCount: number;
  codes: Array<{ id: string; status: string }>;
  requests: Row[];
  quotas: Row[];
  operations: Row[];
  outbox: Row[];
};

export async function readWeb04EventSnapshot(
  tenantId: string,
  eventId: string,
  actorUserId?: string,
): Promise<Web04EventSnapshot> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const query = async (sql: string, values: string[]) =>
      (await client.query(sql, values)).rows as Row[];
    const ticketRows = await query(
      'SELECT count(*)::int AS n FROM tickets WHERE tenant_id=$1::uuid AND event_id=$2::uuid',
      [tenantId, eventId],
    );
    const codes = (await query(
      'SELECT id, status FROM redemption_codes WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id',
      [tenantId, eventId],
    )) as Array<{ id: string; status: string }>;
    const requests = await query(
      `SELECT id, status, actor_user_id, redemption_code_id FROM redemption_requests
       WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`,
      [tenantId, eventId],
    );
    const quotas = await query(
      'SELECT id, scope, scope_id, capacity, allocated FROM quota_buckets WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY scope, id',
      [tenantId, eventId],
    );
    const outbox = await query(
      `SELECT id, type, aggregate_id, status FROM outbox
       WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`,
      [tenantId, eventId],
    );
    const operations = await query(
      actorUserId
        ? `SELECT id, actor_user_id, client_key, status, response_json FROM operations
           WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND actor_user_id=$3::uuid
             AND command='redemption.redeem' ORDER BY created_at, id`
        : `SELECT id, actor_user_id, client_key, status, response_json FROM operations
           WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND command='redemption.redeem'
           ORDER BY created_at, id`,
      actorUserId ? [tenantId, eventId, actorUserId] : [tenantId, eventId],
    );
    await client.query('COMMIT');
    return {
      ticketCount: Number(ticketRows[0]?.n ?? 0),
      codes,
      requests,
      quotas,
      operations,
      outbox: outbox.map(({ status, ...row }) => row),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export function assertWeb04NegativeUnchanged(
  before: Web04EventSnapshot,
  after: Web04EventSnapshot,
  label: string,
): void {
  expect(after.ticketCount, `${label}: must not issue tickets`).toBe(
    before.ticketCount,
  );
  expect(after.codes, `${label}: code status must not change`).toEqual(
    before.codes,
  );
  expect(after.requests, `${label}: redemption_requests must not change`).toEqual(
    before.requests,
  );
  expect(after.quotas, `${label}: quota must not change`).toEqual(
    before.quotas,
  );
  expect(after.outbox, `${label}: outbox must not change`).toEqual(
    before.outbox,
  );
  for (const op of after.operations) {
    expect(op.status, `${label}: no dangling IN_PROGRESS operation`).not.toBe(
      'IN_PROGRESS',
    );
  }
}

/** WEB-05 negative: no request/ticket/code/quota mutation (operations may audit-reject). */
export function assertWeb05BusinessUnchanged(
  before: RedemptionState,
  after: RedemptionState,
  label: string,
): void {
  expect(after.code, `${label}: code row`).toEqual(before.code);
  expect(after.requests, `${label}: requests`).toEqual(before.requests);
  expect(after.tickets, `${label}: tickets`).toEqual(before.tickets);
  expect(after.quotas, `${label}: quotas`).toEqual(before.quotas);
  for (const op of after.operations) {
    expect(op.status, `${label}: no dangling IN_PROGRESS operation`).not.toBe(
      'IN_PROGRESS',
    );
    expect(
      (op.response_json as { ticketId?: string } | null)?.ticketId,
      `${label}: rejected op must not issue ticket`,
    ).toBeUndefined();
  }
}

export function assertRedemptionStateUnchanged(
  before: RedemptionState,
  after: RedemptionState,
  label: string,
): void {
  expect(after.code, `${label}: code row`).toEqual(before.code);
  expect(after.requests, `${label}: requests`).toEqual(before.requests);
  expect(after.tickets, `${label}: tickets`).toEqual(before.tickets);
  expect(after.operations, `${label}: operations`).toEqual(before.operations);
  expect(after.quotas, `${label}: quotas`).toEqual(before.quotas);
  expect(after.outbox.map(({ status, ...row }) => row)).toEqual(
    before.outbox.map(({ status, ...row }) => row),
  );
  for (const op of after.operations) {
    expect(op.status, `${label}: no dangling IN_PROGRESS operation`).not.toBe(
      'IN_PROGRESS',
    );
  }
}

export function assertNoExtraIssue(
  expected: RedemptionState,
  actual: RedemptionState,
) {
  expect(actual.code).toEqual(expected.code);
  expect(actual.requests).toEqual(expected.requests);
  expect(actual.tickets).toEqual(expected.tickets);
  expect(actual.quotas).toEqual(expected.quotas);
  expect(actual.outbox.map(({ status, ...row }) => row)).toEqual(
    expected.outbox.map(({ status, ...row }) => row),
  );
  const ticketId = String(expected.tickets[0].id);
  expect(
    actual.operations.filter(
      (row) =>
        (row.response_json as { ticketId?: string } | null)?.ticketId ===
        ticketId,
    ),
  ).toHaveLength(1);
}

export type RequestConsentSnapshot = {
  formVersion: string | null;
  termsVersion: string | null;
  formDefinitionHash: string | null;
  termsContentHash: string | null;
};

/** Consent columns on the redemption request row (WEB-05 / form gate evidence). */
export async function readRequestConsent(
  fixture: CaseFixture,
  requestId: string,
): Promise<RequestConsentSnapshot> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const rows = await client.query(
      `SELECT form_version, terms_version, form_definition_hash, terms_content_hash
       FROM redemption_requests
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [fixture.tenantId, requestId],
    );
    await client.query('COMMIT');
    expect(rows.rows).toHaveLength(1);
    const row = rows.rows[0] as Row;
    return {
      formVersion: row.form_version != null ? String(row.form_version) : null,
      termsVersion:
        row.terms_version != null ? String(row.terms_version) : null,
      formDefinitionHash:
        row.form_definition_hash != null
          ? String(row.form_definition_hash)
          : null,
      termsContentHash:
        row.terms_content_hash != null ? String(row.terms_content_hash) : null,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

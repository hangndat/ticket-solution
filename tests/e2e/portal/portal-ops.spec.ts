import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

async function expirePendingRequest(tenantId: string, requestId: string) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error('BLOCKED: PORT-06 expiry requires isolated PostgreSQL');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const updated = await client.query(
      "UPDATE redemption_requests SET expires_at = now() - interval '1 hour' WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='PENDING_REVIEW' RETURNING id",
      [tenantId, requestId],
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

async function readTicketResendSnapshot(
  tenantId: string,
  eventId: string,
  ticketId: string,
) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error('BLOCKED: PORT-09 snapshot requires isolated PostgreSQL');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const tickets = await client.query(
      'SELECT COUNT(*)::int AS n FROM tickets WHERE tenant_id=$1::uuid AND event_id=$2::uuid',
      [tenantId, eventId],
    );
    const credentials = await client.query(
      `SELECT version FROM ticket_credentials
       WHERE tenant_id=$1::uuid AND ticket_id=$2::uuid
       ORDER BY version DESC LIMIT 1`,
      [tenantId, ticketId],
    );
    // Compare immutable job identity, not delivery leases/attempts that the
    // worker may legitimately update concurrently with a denied HTTP request.
    const snapshot = await client.query(
      `SELECT
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM tickets t
          WHERE tenant_id=$1::uuid AND id=$2::uuid) AS ticket,
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY version) FROM ticket_credentials c
          WHERE tenant_id=$1::uuid AND ticket_id=$2::uuid) AS credentials,
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM audit_logs a
          WHERE tenant_id=$1::uuid AND resource_id=$2::uuid) AS audits,
        (SELECT jsonb_agg(jsonb_build_object('id', id, 'businessKey', business_key,
          'payload', payload) ORDER BY id) FROM notifications
          WHERE tenant_id=$1::uuid AND business_key LIKE $3) AS notifications,
        (SELECT jsonb_agg(jsonb_build_object('id', id, 'type', type,
          'aggregateId', aggregate_id, 'payload', payload) ORDER BY id) FROM outbox
          WHERE tenant_id=$1::uuid AND aggregate_id=$2::uuid) AS outbox,
        (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM operations o
          WHERE tenant_id=$1::uuid AND event_id=$4::uuid
          AND command='cs.resend') AS operations`,
      [tenantId, ticketId, `ticket:${ticketId}:%`, eventId],
    );
    await client.query('COMMIT');
    return {
      ticketCount: tickets.rows[0]?.n ?? 0,
      credentialVersion: credentials.rows[0]?.version ?? null,
      state: snapshot.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function readAcceptedTicketEmail(tenantId: string, ticketId: string) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error('BLOCKED: PORT-09 SMTP proof requires isolated PostgreSQL');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await client.query(
      `SELECT n.id, n.provider_ref FROM notifications n
       JOIN notification_attempts a ON a.tenant_id=n.tenant_id AND a.notification_id=n.id
       WHERE n.tenant_id=$1::uuid AND n.business_key LIKE $2 AND n.channel='email'
         AND n.state='ACCEPTED' AND a.provider_status='ACCEPTED'
         AND a.provider_ref=n.provider_ref AND n.provider_ref IS NOT NULL
       ORDER BY n.created_at DESC LIMIT 1`,
      [tenantId, `ticket:${ticketId}:%`],
    );
    await client.query('COMMIT');
    return result.rows[0] as { id: string; provider_ref: string } | undefined;
  } finally {
    await client.end();
  }
}

async function readDecisionState(tenantId: string, requestId: string) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: PORT-06 state check requires isolated PostgreSQL',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const tickets = await client.query(
      'SELECT id, owner_user_id FROM tickets WHERE tenant_id=$1::uuid AND request_id=$2::uuid',
      [tenantId, requestId],
    );
    const audits = await client.query(
      "SELECT action, actor_user_id, reason, sanitized_diff FROM audit_logs WHERE tenant_id=$1::uuid AND resource_type='redemption_request' AND resource_id=$2::uuid ORDER BY created_at",
      [tenantId, requestId],
    );
    await client.query('COMMIT');
    return { tickets: tickets.rows, audits: audits.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

test('[PORT-06] Manager approves a pending request in Portal', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-06');
  if (!f.requestId)
    throw new Error('BLOCKED: PORT-06 pending request fixture missing');
  await login(page, m, 'PORT-06', 'manager');
  const before = await bffGet(
    page,
    m,
    `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${f.requestId}`,
  );
  expect(before.status).toBe(200);
  expect(JSON.stringify(before.json)).toContain(f.requestId);
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pending = page.locator('#pending');
  await pending
    .getByPlaceholder('Tìm theo mã UUID của yêu cầu')
    .fill(f.requestId);
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  const row = pending.getByRole('row', { name: new RegExp(f.requestId) });
  await expect(row).toBeVisible();
  const approved = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${f.requestId}/approve`) &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Duyệt' }).click();
  const approvedResponse = await approved;
  expect([200, 201]).toContain(approvedResponse.status());
  const approvedBody = await approvedResponse.json();
  expect(approvedBody).toMatchObject({
    decision: 'approve',
    requestId: f.requestId,
    status: 'ISSUED',
  });
  expect(approvedBody.ticketId).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(pending.getByTestId('pending-notice')).toContainText(
    `Đã duyệt yêu cầu ${f.requestId}`,
  );
  const after = await bffGet(
    page,
    m,
    `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${f.requestId}`,
  );
  expect(after.status).toBe(200);
  await expect
    .poll(async () => {
      const snapshot = await bffGet(
        page,
        m,
        `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${f.requestId}`,
      );
      expect(snapshot.status).toBe(200);
      return JSON.stringify(snapshot.json).includes(f.requestId!);
    })
    .toBe(false);
  const audit = await bffGet(
    page,
    m,
    eventBff(f, '/audit?limit=50&action=redemption.approved'),
  );
  expect(audit.status).toBe(200);
  const entries = (audit.json as { items: Array<Record<string, unknown>> })
    .items;
  expect(entries.filter((item) => item.resourceId === f.requestId)).toEqual([
    expect.objectContaining({
      action: 'redemption.approved',
      actorUserId: accountFor(m, 'PORT-06', 'manager').userId,
      resourceType: 'redemption_request',
      resourceId: f.requestId,
    }),
  ]);
  const state = await readDecisionState(f.tenantId, f.requestId);
  expect(state.tickets).toEqual([
    expect.objectContaining({
      id: approvedBody.ticketId,
      owner_user_id: accountFor(m, 'PORT-06', 'attendee').userId,
    }),
  ]);
  expect(
    state.audits.filter(
      (item: { action: string }) => item.action === 'redemption.approved',
    ),
  ).toEqual([
    expect.objectContaining({
      actor_user_id: accountFor(m, 'PORT-06', 'manager').userId,
      sanitized_diff: expect.objectContaining({
        ownerUserId: accountFor(m, 'PORT-06', 'attendee').userId,
      }),
    }),
  ]);
});

test('[PORT-06] Manager denies a pending request with a reason and audit records it', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-06');
  const requestId = f.data?.denyRequestId;
  const reason = f.data?.denyReason;
  if (typeof requestId !== 'string' || typeof reason !== 'string')
    throw new Error('BLOCKED: PORT-06 deny fixture missing');
  await login(page, m, 'PORT-06', 'manager');
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pending = page.locator('#pending');
  await pending
    .getByPlaceholder('Tìm theo mã UUID của yêu cầu')
    .fill(requestId);
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  const row = pending.getByRole('row', { name: new RegExp(requestId) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Từ chối' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(reason);
  const denied = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${requestId}/deny`) &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click();
  const deniedResponse = await denied;
  expect([200, 201]).toContain(deniedResponse.status());
  expect(deniedResponse.request().postDataJSON()).toMatchObject({ reason });
  expect(await deniedResponse.json()).toMatchObject({
    decision: 'deny',
    requestId,
    status: 'REJECTED',
    ticketId: null,
  });
  await expect(pending.getByTestId('pending-notice')).toContainText(
    `Đã từ chối yêu cầu ${requestId}`,
  );
  const notFoundAnymore = await bffGet(
    page,
    m,
    `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${requestId}`,
  );
  expect(notFoundAnymore.status).toBe(200);
  expect(JSON.stringify(notFoundAnymore.json)).not.toContain(requestId);
  const audit = await bffGet(
    page,
    m,
    eventBff(f, '/audit?limit=20&action=redemption.denied'),
  );
  expect(audit.status).toBe(200);
  const auditBody = audit.json as { items: Array<Record<string, unknown>> };
  const entry = auditBody.items.find((item) => item.resourceId === requestId);
  expect(entry).toBeTruthy();
  expect(entry?.action).toBe('redemption.denied');
  expect(entry?.actorUserId).toBe(accountFor(m, 'PORT-06', 'manager').userId);
  expect(entry?.resourceType).toBe('redemption_request');
  const auditText = JSON.stringify(entry);
  expect(auditText).not.toContain(reason);
  for (const key of [
    'reason',
    'reasonCode',
    'sanitizedDiff',
    'rawCode',
    'email',
  ])
    expect(entry).not.toHaveProperty(key);
  const state = await readDecisionState(f.tenantId, requestId);
  expect(state.tickets).toHaveLength(0);
  expect(
    state.audits.filter(
      (item: { action: string }) => item.action === 'redemption.denied',
    ),
  ).toEqual([
    expect.objectContaining({
      actor_user_id: accountFor(m, 'PORT-06', 'manager').userId,
      reason,
      sanitized_diff: expect.objectContaining({
        ownerUserId: accountFor(m, 'PORT-06', 'attendee').userId,
      }),
    }),
  ]);
});

test('[PORT-06] Deciding an expired pending request fails closed without issuing a ticket', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-06');
  const requestId = f.data?.expiredRequestId;
  if (typeof requestId !== 'string')
    throw new Error('BLOCKED: PORT-06 expired fixture missing');
  await login(page, m, 'PORT-06', 'manager');
  const audit = await bffGet(
    page,
    m,
    eventBff(f, '/audit?limit=50&action=redemption.approved'),
  );
  expect(audit.status).toBe(200);
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pending = page.locator('#pending');
  await pending
    .getByPlaceholder('Tìm theo mã UUID của yêu cầu')
    .fill(requestId);
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  const row = pending.getByRole('row', { name: new RegExp(requestId) });
  await expect(row).toBeVisible();
  await expirePendingRequest(f.tenantId, requestId);
  const rejected = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${requestId}/approve`) &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Duyệt' }).click();
  const rejectedResponse = await rejected;
  expect(rejectedResponse.status()).toBe(409);
  expect(((await rejectedResponse.json()) as { code: string }).code).toBe(
    'PENDING_EXPIRED',
  );
  await expect(pending.getByTestId('pending-notice')).toContainText(
    'PENDING_EXPIRED',
  );
  const afterAudit = await bffGet(
    page,
    m,
    eventBff(f, '/audit?limit=50&action=redemption.approved'),
  );
  expect(afterAudit.status).toBe(200);
  expect(
    (afterAudit.json as { items: Array<{ resourceId: string }> }).items.some(
      (item) => item.resourceId === requestId,
    ),
  ).toBe(false);
  expect((await readDecisionState(f.tenantId, requestId)).tickets).toHaveLength(
    0,
  );
});

test('[PORT-06] Quota exhausted between request and decision blocks approval and links to quota', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-06');
  const requestId = f.data?.quotaExhaustedRequestId;
  if (typeof requestId !== 'string')
    throw new Error('BLOCKED: PORT-06 quota-exhausted fixture missing');
  await login(page, m, 'PORT-06', 'manager');
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pending = page.locator('#pending');
  await pending
    .getByPlaceholder('Tìm theo mã UUID của yêu cầu')
    .fill(requestId);
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  const row = pending.getByRole('row', { name: new RegExp(requestId) });
  await expect(row).toBeVisible();
  const rejected = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${requestId}/approve`) &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Duyệt' }).click();
  const rejectedResponse = await rejected;
  expect(rejectedResponse.status()).toBe(409);
  expect(((await rejectedResponse.json()) as { code: string }).code).toBe(
    'QUOTA_EXHAUSTED',
  );
  await expect(
    page.getByText('QUOTA_EXHAUSTED', { exact: true }),
  ).toBeVisible();
  await expect(pending.getByTestId('pending-notice')).toContainText(
    'QUOTA_EXHAUSTED',
  );
  await expect(
    page.getByRole('link', { name: 'Kiểm tra quota' }),
  ).toBeVisible();
  const still = await bffGet(
    page,
    m,
    `${eventBff(f, '/redemptions')}?status=PENDING_REVIEW&q=${requestId}`,
  );
  expect(still.status).toBe(200);
  expect(JSON.stringify(still.json)).toContain(requestId);
  const audit = await bffGet(
    page,
    m,
    eventBff(f, '/audit?limit=50&action=redemption.approved'),
  );
  expect(audit.status).toBe(200);
  expect(
    (audit.json as { items: Array<{ resourceId: string }> }).items.some(
      (item) => item.resourceId === requestId,
    ),
  ).toBe(false);
  expect((await readDecisionState(f.tenantId, requestId)).tickets).toHaveLength(
    0,
  );
});

test('[PORT-06] Replaying an already-decided approval is idempotent and does not double-issue', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-06');
  const requestId = f.data?.decidedRequestId;
  const ticketId = f.data?.decidedTicketId;
  if (typeof requestId !== 'string' || typeof ticketId !== 'string')
    throw new Error('BLOCKED: PORT-06 decided fixture missing');
  await login(page, m, 'PORT-06', 'manager');
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  await expect(page.locator('#pending')).toBeVisible();
  const replay = await bffMutate(
    page,
    `${eventBff(f, '/redemptions')}/${encodeURIComponent(requestId)}/approve`,
    { idempotencyKey: randomUUID() },
  );
  expect([200, 201]).toContain(replay.status);
  const replayBody = replay.json as {
    decision: string;
    status: string;
    ticketId: string;
    requestId: string;
  };
  expect(replayBody.decision).toBe('approve');
  expect(replayBody.status).toBe('ISSUED');
  expect(replayBody.ticketId).toBe(ticketId);
  expect(replayBody.requestId).toBe(requestId);
  const audit = await bffGet(
    page,
    m,
    eventBff(f, '/audit?limit=50&action=redemption.approved'),
  );
  expect(audit.status).toBe(200);
  const auditBody = audit.json as { items: Array<Record<string, unknown>> };
  const matches = auditBody.items.filter(
    (item) => item.resourceId === requestId,
  );
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({
    actorUserId: accountFor(m, 'PORT-06', 'manager').userId,
    action: 'redemption.approved',
    resourceType: 'redemption_request',
  });
  const state = await readDecisionState(f.tenantId, requestId);
  expect(state.tickets).toEqual([
    expect.objectContaining({
      id: ticketId,
      owner_user_id: accountFor(m, 'PORT-06', 'otherAttendee').userId,
    }),
  ]);
  const conflict = await bffMutate(
    page,
    `${eventBff(f, '/redemptions')}/${encodeURIComponent(requestId)}/deny`,
    { idempotencyKey: randomUUID(), reason: 'Không hợp lệ' },
  );
  expect(conflict.status).toBe(409);
  expect((conflict.json as { code: string }).code).toBe('DECISION_CONFLICT');
  const afterConflict = await readDecisionState(f.tenantId, requestId);
  expect(afterConflict.tickets).toEqual(state.tickets);
  expect(afterConflict.audits).toEqual(state.audits);
});

test('[PORT-09] CS lookup masks PII and resend preserves the ticket with cooldown', async ({
  page,
  browser,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-09');
  if (!f.ticketId) throw new Error('BLOCKED: PORT-09 ticket missing');
  const matrix = f.data?.matrixTicketIds as Record<string, string> | undefined;
  const resendLimitTicketId = f.data?.resendLimitTicketId;
  const otherEventTicketId = f.data?.otherEventTicketId;
  const foreignTenantId = f.data?.foreignTenantId;
  const foreignEventId = f.data?.foreignEventId;
  const foreignTicketId = f.data?.foreignTicketId;
  if (
    !matrix?.accepted ||
    !matrix.failed ||
    !matrix.dead ||
    !matrix.pending ||
    !matrix.unknown ||
    typeof resendLimitTicketId !== 'string' ||
    typeof otherEventTicketId !== 'string' ||
    typeof foreignTenantId !== 'string' ||
    typeof foreignEventId !== 'string' ||
    typeof foreignTicketId !== 'string'
  ) {
    throw new Error('BLOCKED: PORT-09 notification matrix fixture missing');
  }
  await login(page, m, 'PORT-09', 'cs');
  // The primary ticket must be sent by the real worker, never promoted by seed SQL.
  await expect
    .poll(
      async () => {
        const result = await bffGet(
          page,
          m,
          eventBff(f, `/tickets/${matrix.accepted}`),
        );
        return (result.json as { notification?: { providerStatus: string } })
          .notification?.providerStatus;
      },
      { timeout: 60_000 },
    )
    .toBe('ACCEPTED');
  const acceptedEmail = await readAcceptedTicketEmail(
    f.tenantId,
    matrix.accepted,
  );
  expect(acceptedEmail).toBeTruthy();
  expect(acceptedEmail!.provider_ref).not.toMatch(/^noop:/);
  const mailResponse = await page.request.get(
    new URL('/api/v1/messages', m.origins.mailpit).toString(),
  );
  expect(mailResponse.status()).toBe(200);
  const mail = (await mailResponse.json()) as {
    messages: Array<{ ID: string; MessageID: string }>;
  };
  const message = mail.messages.find(
    (item) =>
      item.MessageID.replace(/[<>]/g, '') ===
      acceptedEmail!.provider_ref.replace(/[<>]/g, ''),
  );
  expect(
    message,
    'Mailpit Message-ID must match the exact accepted notification provider_ref',
  ).toBeTruthy();
  const delivered = await page.request.get(
    new URL(`/api/v1/message/${message!.ID}`, m.origins.mailpit).toString(),
  );
  expect(delivered.status()).toBe(200);
  expect(((await delivered.json()) as { Text: string }).Text).toContain(
    matrix.accepted,
  );
  const list = await bffGet(page, m, eventBff(f, '/tickets?limit=50'));
  expect(list.status).toBe(200);
  const listed = (list.json as { items: Array<Record<string, unknown>> }).items;
  const statuses = new Set(
    listed
      .map((item) =>
        item.notification
          ? (item.notification as { providerStatus: string }).providerStatus
          : null,
      )
      .filter(Boolean),
  );
  for (const expected of [
    'ACCEPTED',
    'FAILED',
    'DEAD',
    'PENDING',
    'UNKNOWN',
  ] as const) {
    expect(statuses.has(expected)).toBe(true);
  }
  const unknownRow = listed.find((item) => item.ticketId === matrix.unknown);
  expect(unknownRow?.notification).toBeTruthy();
  expect(
    (unknownRow!.notification as { providerStatus: string }).providerStatus,
  ).toBe('UNKNOWN');
  for (const [key, expected] of Object.entries({
    accepted: 'ACCEPTED',
    failed: 'FAILED',
    dead: 'DEAD',
    pending: 'PENDING',
    unknown: 'UNKNOWN',
  })) {
    const id = matrix[key];
    const item = listed.find((candidate) => candidate.ticketId === id);
    expect(
      (item?.notification as { providerStatus: string })?.providerStatus,
    ).toBe(expected);
    const detail = await bffGet(page, m, eventBff(f, `/tickets/${id}`));
    expect(detail.status).toBe(200);
    const projection = detail.json as {
      notification: { providerStatus: string };
      timeline: Array<{ summary: string }>;
    };
    expect(projection.notification.providerStatus).toBe(expected);
    expect(
      projection.timeline.some(
        (entry) => entry.summary === `notification ${expected}`,
      ),
    ).toBe(true);
  }
  const response = await bffGet(
    page,
    m,
    eventBff(f, `/tickets?q=${f.ticketId}&limit=50`),
  );
  expect(response.status).toBe(200);
  const body = response.json as { items: Array<Record<string, unknown>> };
  expect(body.items).toHaveLength(1);
  expect(body.items[0].ticketId).toBe(f.ticketId);
  for (const item of body.items) {
    expect(item.notification).toBeTruthy();
    expect(['PENDING', 'ACCEPTED', 'FAILED', 'DEAD', 'UNKNOWN']).toContain(
      (item.notification as { providerStatus: string }).providerStatus,
    );
    for (const key of [
      'email',
      'ownerEmail',
      'rawEmail',
      'token',
      'qr',
      'qrPayload',
    ])
      expect(item).not.toHaveProperty(key);
  }
  const detailPath = eventBff(f, `/tickets/${f.ticketId}`);
  const before = await bffGet(page, m, detailPath);
  expect(before.status).toBe(200);
  const timeline = (before.json as { timeline: unknown[] }).timeline;
  expect(Array.isArray(timeline)).toBe(true);
  for (const entry of timeline) {
    const text = JSON.stringify(entry);
    expect(text).not.toMatch(/@[^"\s]+\.[^"\s]+/);
    for (const key of ['email', 'ownerEmail', 'rawEmail', 'qrPayload', 'token'])
      expect(entry as Record<string, unknown>).not.toHaveProperty(key);
  }
  const outOfScope = await bffGet(
    page,
    m,
    eventBff(f, `/tickets?q=${randomUUID()}&limit=20`),
  );
  expect(outOfScope.status).toBe(200);
  expect((outOfScope.json as { items: unknown[] }).items).toHaveLength(0);
  const crossEvent = await bffGet(
    page,
    m,
    eventBff(f, `/tickets?q=${otherEventTicketId}&limit=20`),
  );
  expect(crossEvent.status).toBe(200);
  expect((crossEvent.json as { items: unknown[] }).items).toHaveLength(0);
  const crossTenant = await bffGet(
    page,
    m,
    `/api/bff/tenants/${encodeURIComponent(foreignTenantId)}/events/${encodeURIComponent(foreignEventId)}/tickets?q=${encodeURIComponent(foreignTicketId)}&limit=20`,
  );
  expect(crossTenant.status).toBeGreaterThanOrEqual(400);
  const pgBeforeResend = await readTicketResendSnapshot(
    f.tenantId,
    f.eventId,
    f.ticketId,
  );
  await page.goto(portalUrl(m, eventPath(f, '/support')));
  const panel = page.locator('#cs');
  await panel.getByPlaceholder('Mã vé hoặc mã yêu cầu').fill(matrix.unknown);
  await panel.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  const unknownBrowserRow = panel
    .getByRole('row')
    .filter({ hasText: matrix.unknown });
  await expect(unknownBrowserRow).toContainText('UNKNOWN');
  await expect(unknownBrowserRow).not.toContainText('PENDING');
  await unknownBrowserRow
    .getByRole('button', { name: 'Chi tiết', exact: true })
    .click();
  await expect(
    panel.getByText('notification UNKNOWN', { exact: true }),
  ).toBeVisible();
  await panel.getByPlaceholder('Mã vé hoặc mã yêu cầu').fill(f.ticketId);
  await panel.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  const row = panel.getByRole('row').filter({ hasText: f.ticketId });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(
    panel.getByRole('heading', { name: `Timeline — ${f.ticketId}` }),
  ).toBeVisible();
  const sent = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/tickets/${f.ticketId}/resend`) &&
      r.request().method() === 'POST',
  );
  await panel
    .getByRole('button', { name: 'Resend email', exact: true })
    .click();
  expect([200, 201]).toContain((await sent).status());
  const pgBeforeCooldown = await readTicketResendSnapshot(
    f.tenantId,
    f.eventId,
    f.ticketId,
  );
  const cooldown = await bffMutate(page, `${detailPath}/resend`, {
    idempotencyKey: randomUUID(),
  });
  const pgAfterCooldown = await readTicketResendSnapshot(
    f.tenantId,
    f.eventId,
    f.ticketId,
  );
  expect(pgAfterCooldown).toEqual(pgBeforeCooldown);
  expect(cooldown.status).toBe(429);
  expect((cooldown.json as { code: string }).code).toBe('RESEND_COOLDOWN');
  const after = await bffGet(page, m, detailPath);
  expect(after.status).toBe(200);
  expect((after.json as { ticketId: string; state: string }).ticketId).toBe(
    f.ticketId,
  );
  expect((after.json as { state: string }).state).toBe(
    (before.json as { state: string }).state,
  );
  const pgAfterResend = await readTicketResendSnapshot(
    f.tenantId,
    f.eventId,
    f.ticketId,
  );
  expect(pgAfterResend.ticketCount).toBe(pgBeforeResend.ticketCount);
  expect(pgAfterResend.credentialVersion).toBe(
    pgBeforeResend.credentialVersion,
  );
  const limitPath = eventBff(f, `/tickets/${resendLimitTicketId}`);
  const limitBefore = await bffGet(page, m, limitPath);
  expect(limitBefore.status).toBe(200);
  const pgBeforeLimit = await readTicketResendSnapshot(
    f.tenantId,
    f.eventId,
    resendLimitTicketId,
  );
  const limitResend = await bffMutate(
    page,
    portalUrl(m, `${limitPath}/resend`),
    {
      idempotencyKey: randomUUID(),
    },
  );
  const pgAfterLimit = await readTicketResendSnapshot(
    f.tenantId,
    f.eventId,
    resendLimitTicketId,
  );
  expect(pgAfterLimit).toEqual(pgBeforeLimit);
  expect(limitResend.status).toBe(429);
  expect((limitResend.json as { code: string }).code).toBe('RESEND_LIMIT');
  const limitAfter = await bffGet(page, m, limitPath);
  expect((limitAfter.json as { state: string }).state).toBe(
    (limitBefore.json as { state: string }).state,
  );
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  try {
    await login(managerPage, m, 'PORT-09', 'manager');
    const unknownList = await bffGet(
      managerPage,
      m,
      eventBff(f, '/notifications?state=UNKNOWN&limit=50'),
    );
    expect(unknownList.status).toBe(200);
    const unknownItems = (
      unknownList.json as { items: Array<{ providerStatus: string }> }
    ).items;
    expect(unknownItems.some((item) => item.providerStatus === 'UNKNOWN')).toBe(
      true,
    );
    await expect(
      managerPage.getByText('DELIVERED', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await managerContext.close();
  }
});

test('[PORT-12] self-serve registration remains PENDING', async ({ page }) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-12');
  const name = f.data?.registrationName;
  const slug = f.data?.registrationSlug;
  if (typeof name !== 'string' || typeof slug !== 'string')
    throw new Error('BLOCKED: PORT-12 unique registration values missing');
  await login(page, m, 'PORT-12', 'owner');
  await page.goto(portalUrl(m, '/onboarding'));
  await page.getByLabel('Tên tổ chức').fill(name);
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Gửi đăng ký' }).click();
  await expect(page).toHaveURL(/\/onboarding\/[0-9a-f-]+/);
  const tenantId = new URL(page.url()).pathname.split('/')[2];
  const tenants = await bffGet(page, m, '/api/bff/me/tenants');
  expect(tenants.status).toBe(200);
  expect(JSON.stringify(tenants.json)).toContain(tenantId);
  await expect(page.getByText(/chờ|PENDING/i).first()).toBeVisible();
});

test('[PORT-14] audit/codes BFF projections omit raw secrets', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-14');
  await login(page, m, 'PORT-14', 'owner');
  for (const endpoint of ['/audit?limit=20', '/codes?limit=20']) {
    const response = await bffGet(page, m, eventBff(f, endpoint));
    expect(response.status).toBe(200);
    const text = JSON.stringify(response.json);
    expect(text).not.toMatch(
      /"(?:rawCode|tokenHash|hmac|qrPayload|ownerEmail|rawEmail)"\s*:/i,
    );
  }
  await page.goto(portalUrl(m, eventPath(f, '/audit')));
  await expect(page.getByTestId('audit-table')).toBeVisible();
});

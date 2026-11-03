import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOwnerRedemptionStatus } from '../src/redeem/owner-status';
import {
  ownerRefreshPlan,
  refreshOwnerRedemption,
} from '../src/redeem/owner-refresh';
import { GET } from '../app/api/bff/redemptions/[requestId]/route';

const requestId = '55555555-5555-4555-8555-555555555555';
const tenantId = '11111111-1111-4111-8111-111111111111';

test('owner refresh preserves tenant scope and reads a real API-shaped issued response', async () => {
  const result = await fetchOwnerRedemptionStatus(
    requestId,
    tenantId,
    async (input) => {
      const url = new URL(String(input), 'http://localhost');
      assert.equal(url.searchParams.get('tenantId'), tenantId);
      assert.equal(url.pathname, `/api/bff/redemptions/${requestId}`);
      return Response.json({
        status: 'ISSUED',
        requestId,
        eventId: requestId,
        ticketId: requestId,
        ticketTypeId: requestId,
        sourceId: requestId,
        issuedAt: '2026-10-26T00:00:00Z',
      });
    },
  );
  assert.equal(result.status, 'ok');
});

test('missing scope never sends an owner status request', async () => {
  const result = await fetchOwnerRedemptionStatus(requestId, ' ', async () => {
    throw new Error('must not fetch without tenant scope');
  });
  assert.deepEqual(result, { status: 'invalid' });
});

test('owner refresh maps issued status to an active ticket and issued decision', () => {
  const plan = ownerRefreshPlan({
    status: 'ISSUED',
    requestId,
    eventId: requestId,
    ticketId: requestId,
    ticketTypeId: requestId,
    sourceId: requestId,
    issuedAt: '2026-10-26T00:00:00Z',
  });
  assert.equal(plan.decision?.kind, 'issued');
  assert.equal(plan.ticket?.ticketId, requestId);
  assert.equal(plan.ticket?.state, 'ACTIVE');
  assert.equal(plan.clearPendingRequest, undefined);
});

test('owner refresh keeps pending state and clears request only for terminal statuses', () => {
  const pending = ownerRefreshPlan({
    status: 'PENDING_REVIEW',
    requestId,
    eventId: requestId,
    ticketTypeId: requestId,
    sourceId: requestId,
    expiresAt: null,
    submittedAt: '2026-10-26T00:00:00Z',
  });
  assert.deepEqual(pending, {});

  const rejected = ownerRefreshPlan({
    status: 'REJECTED',
    requestId,
    eventId: requestId,
    ticketTypeId: requestId,
    sourceId: requestId,
    reason: null,
    decidedAt: '2026-10-26T00:00:00Z',
  });
  assert.equal(rejected.decision, null);
  assert.equal(rejected.clearPendingRequest, true);
});

test('BFF rejects missing or malformed tenant scope before reading the session', async () => {
  for (const query of ['', '?tenantId=invalid']) {
    const response = await GET(
      new Request(`http://localhost/api/bff/redemptions/${requestId}${query}`),
      {
        params: Promise.resolve({ requestId }),
      },
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, 'SCOPE_REQUIRED');
  }
});

test('owner status authorization failure is preserved as unauthorized', async () => {
  const result = await fetchOwnerRedemptionStatus(
    requestId,
    tenantId,
    async () => new Response(null, { status: 401 }),
  );
  assert.deepEqual(result, { status: 'unauthorized' });
});

test('refresh ignores a response after the form generation changes', async () => {
  let release!: (response: Response) => void;
  let current = true;
  const response = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const pending = refreshOwnerRedemption({
    requestId,
    tenantId,
    locale: 'en',
    isCurrent: () => current,
    fetchImpl: async () => response,
  });
  current = false;
  release(new Response(null, { status: 401 }));
  assert.deepEqual(await pending, { kind: 'stale' });
});

test('refresh interprets unauthorized without changing ticket state', async () => {
  const outcome = await refreshOwnerRedemption({
    requestId,
    tenantId,
    locale: 'en',
    isCurrent: () => true,
    fetchImpl: async () => new Response(null, { status: 403 }),
  });
  assert.equal(outcome.kind, 'ready');
  if (outcome.kind !== 'ready') return;
  assert.equal(outcome.ux.kind, 'auth');
  assert.equal(outcome.plan, undefined);
  assert.equal(outcome.raw, undefined);
});

test('refresh clears a terminal request but preserves a pending one', async () => {
  for (const status of ['PENDING_REVIEW', 'REJECTED'] as const) {
    const body =
      status === 'PENDING_REVIEW'
        ? {
            status,
            requestId,
            eventId: requestId,
            ticketTypeId: requestId,
            sourceId: requestId,
            expiresAt: null,
            submittedAt: '2026-10-26T00:00:00Z',
          }
        : {
            status,
            requestId,
            eventId: requestId,
            ticketTypeId: requestId,
            sourceId: requestId,
            reason: null,
            decidedAt: '2026-10-26T00:00:00Z',
          };
    const outcome = await refreshOwnerRedemption({
      requestId,
      tenantId,
      locale: 'en',
      isCurrent: () => true,
      fetchImpl: async () => Response.json(body),
    });
    assert.equal(outcome.kind, 'ready');
    if (outcome.kind !== 'ready') continue;
    assert.equal(
      outcome.plan?.clearPendingRequest,
      status === 'REJECTED' ? true : undefined,
    );
    assert.equal(outcome.raw, JSON.stringify(body, null, 2));
  }
});

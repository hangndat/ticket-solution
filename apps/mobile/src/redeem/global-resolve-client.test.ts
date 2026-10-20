import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REDEMPTION_RESOLVE_HEADER } from '@ticket/contracts';
import { resolveRedemptionCodeGlobal } from './global-resolve-client.ts';

test('resolve POST hits /v1/redemptions/resolve with bearer', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    seenUrl = String(input);
    seenInit = init;
    return new Response(
      JSON.stringify({
        tenantId: '22222222-2222-4222-8222-222222222222',
        eventId: '33333333-3333-4333-8333-333333333333',
        ticketTypeId: 'tt',
        sourceId: 'src',
        tenantDisplayName: 'Org',
        eventTitle: 'Event',
        ticketTypeLabel: 'GA',
        approvalMode: 'AUTO',
        redemptionWindow: { opensAt: null, closesAt: null, open: true },
        published: {
          form: null,
          terms: null,
          schemaVersion: 1,
          publishedConfigVersion: 1,
        },
        resolveToken: 'tok',
        resolveExpiresAt: '2099-01-01T00:00:00.000Z',
        redemptionFlow: 'global',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const result = await resolveRedemptionCodeGlobal({
    apiBase: 'http://api.test',
    bearer: 'access',
    code: ' ABC ',
    fetchImpl,
  });
  assert.equal(result.status, 'ok');
  assert.match(seenUrl, /\/v1\/redemptions\/resolve$/);
  assert.equal(seenInit?.method, 'POST');
  const headers = seenInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer access');
  assert.deepEqual(JSON.parse(String(seenInit?.body)), { code: 'ABC' });
  if (result.status === 'ok') {
    assert.equal(result.body.resolveToken, 'tok');
    assert.notEqual(REDEMPTION_RESOLVE_HEADER, '');
  }
});

test('RESOLVE_DISABLED maps to Vietnamese without server message leak', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        code: 'RESOLVE_DISABLED',
        message: 'Global code resolve is not enabled',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  const result = await resolveRedemptionCodeGlobal({
    apiBase: 'https://api.vemoki.com',
    bearer: 'access',
    code: 'UAT-INVALID-20261020',
    fetchImpl,
  });
  assert.equal(result.status, 'error');
  if (result.status !== 'error') return;
  assert.equal(result.code, 'RESOLVE_DISABLED');
  assert.doesNotMatch(result.message, /Global code resolve/i);
  assert.doesNotMatch(result.message, /HTTP/i);
  assert.match(result.message, /chưa hỗ trợ tra cứu mã toàn hệ thống/i);
});

test('unknown resolve error code does not pass through API message', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        code: 'INTERNAL_DEBUG_LEAK',
        message: 'postgres timeout at resolver.ts:404',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  const result = await resolveRedemptionCodeGlobal({
    apiBase: 'https://api.vemoki.com',
    bearer: 'access',
    code: 'X',
    fetchImpl,
  });
  assert.equal(result.status, 'error');
  if (result.status !== 'error') return;
  assert.equal(result.code, 'INTERNAL_DEBUG_LEAK');
  assert.doesNotMatch(result.message, /postgres/i);
  assert.doesNotMatch(result.message, /HTTP/i);
  assert.match(result.message, /Không tra cứu được mã/i);
});

test('non-json error body uses generic message not status text', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('gateway timeout', { status: 504 });
  const result = await resolveRedemptionCodeGlobal({
    apiBase: 'https://api.vemoki.com',
    bearer: 'access',
    code: 'X',
    fetchImpl,
  });
  assert.equal(result.status, 'error');
  if (result.status !== 'error') return;
  assert.equal(result.code, 'UNKNOWN');
  assert.doesNotMatch(result.message, /504/);
  assert.doesNotMatch(result.message, /gateway/i);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadPublishedRedeemSchema,
  parsePublishedRedeemSchema,
} from '../src/redeem/published-schema';

const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

const baseProjection = {
  id: EVENT_ID,
  schemaVersion: 1,
  publishedConfigVersion: 2,
  form: {
    formVersion: 'form-v1',
    fields: [{ id: 'full_name', label: 'Name', type: 'text', required: true }],
  },
  terms: { version: 'terms-v1', bodyMarkdown: 'Be kind.' },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('parsePublishedRedeemSchema accepts tenantId UUID from projection', () => {
  const schema = parsePublishedRedeemSchema({
    ...baseProjection,
    tenantId: TENANT_ID,
  });
  assert.ok(schema);
  assert.equal(schema?.eventId, EVENT_ID);
  assert.equal(schema?.tenantId, TENANT_ID);
});

test('parsePublishedRedeemSchema rejects invalid tenantId', () => {
  assert.equal(
    parsePublishedRedeemSchema({ ...baseProjection, tenantId: 'not-a-uuid' }),
    null,
  );
  assert.equal(
    parsePublishedRedeemSchema({ ...baseProjection, tenantId: '' }),
    null,
  );
});

test('parsePublishedRedeemSchema stays compatible without tenantId', () => {
  const schema = parsePublishedRedeemSchema(baseProjection);
  assert.ok(schema);
  assert.equal(schema?.tenantId, undefined);
});

test('loadPublishedRedeemSchema slug flow maps tenantId from BFF projection', async () => {
  const calls: string[] = [];
  const result = await loadPublishedRedeemSchema(
    'demo-org',
    'summer-fest',
    async (url, init) => {
      calls.push(String(url));
      assert.equal(init?.method, 'GET');
      return jsonResponse(200, {
        ...baseProjection,
        tenantId: TENANT_ID,
      });
    },
  );
  assert.equal(calls.length, 1);
  assert.match(
    calls[0] ?? '',
    /\/api\/bff\/public\/tenants\/demo-org\/events\/summer-fest$/,
  );
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.schema.tenantId, TENANT_ID);
    assert.equal(result.schema.eventId, EVENT_ID);
  }
});

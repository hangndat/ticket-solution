import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveGateScanFallback } from './staff-gate-scope-resolve.ts';

test('resolveGateScanFallback prefers MeEvents selection', () => {
  assert.deepEqual(
    resolveGateScanFallback({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    }),
    {
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    },
  );
});

test('resolveGateScanFallback uses env when no selection', () => {
  const prevTenant = process.env.EXPO_PUBLIC_TENANT_ID;
  const prevEvent = process.env.EXPO_PUBLIC_EVENT_ID;
  process.env.EXPO_PUBLIC_TENANT_ID =
    'cccccccc-cccc-cccc-cccc-cccccccccccc';
  process.env.EXPO_PUBLIC_EVENT_ID =
    'dddddddd-dddd-dddd-dddd-dddddddddddd';
  try {
    assert.deepEqual(resolveGateScanFallback(null), {
      tenantId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      eventId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    });
  } finally {
    if (prevTenant === undefined) delete process.env.EXPO_PUBLIC_TENANT_ID;
    else process.env.EXPO_PUBLIC_TENANT_ID = prevTenant;
    if (prevEvent === undefined) delete process.env.EXPO_PUBLIC_EVENT_ID;
    else process.env.EXPO_PUBLIC_EVENT_ID = prevEvent;
  }
});

test('resolveGateScanFallback ignores local test placeholders', () => {
  const prevTenant = process.env.EXPO_PUBLIC_TENANT_ID;
  const prevEvent = process.env.EXPO_PUBLIC_EVENT_ID;
  process.env.EXPO_PUBLIC_TENANT_ID =
    'a1111111-1111-4111-8111-111111111111';
  process.env.EXPO_PUBLIC_EVENT_ID =
    'b2222222-2222-4222-8222-222222222222';
  try {
    assert.deepEqual(resolveGateScanFallback(null), {
      tenantId: null,
      eventId: null,
    });
  } finally {
    if (prevTenant === undefined) delete process.env.EXPO_PUBLIC_TENANT_ID;
    else process.env.EXPO_PUBLIC_TENANT_ID = prevTenant;
    if (prevEvent === undefined) delete process.env.EXPO_PUBLIC_EVENT_ID;
    else process.env.EXPO_PUBLIC_EVENT_ID = prevEvent;
  }
});

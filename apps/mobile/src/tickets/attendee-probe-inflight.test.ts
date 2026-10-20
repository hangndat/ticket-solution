import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MeTicketsProbeResult } from './fetch-me-tickets.ts';
import {
  attendeeProbeInflightKey,
  dedupedAttendeeProbeMeTickets,
  resetAttendeeProbeInflightForTests,
} from './attendee-probe-inflight.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('attendeeProbeInflightKey partitions by userId and session scope', () => {
  assert.equal(
    attendeeProbeInflightKey('user-a', 'tenant-1'),
    'user-a:tenant-1',
  );
  assert.notEqual(
    attendeeProbeInflightKey('user-a', 'tenant-1'),
    attendeeProbeInflightKey('user-b', 'tenant-1'),
  );
  assert.notEqual(
    attendeeProbeInflightKey('user-a', '__owner__'),
    attendeeProbeInflightKey('user-a', 'tenant-1'),
  );
});

test('dedupedAttendeeProbeMeTickets shares one in-flight probe per key', async () => {
  resetAttendeeProbeInflightForTests();
  const gate = deferred<MeTicketsProbeResult>();
  let calls = 0;
  const runProbe = async () => {
    calls += 1;
    return gate.promise;
  };

  const scope = { kind: 'owner' as const };
  const first = dedupedAttendeeProbeMeTickets(
    'user-1',
    '__owner__',
    'bearer',
    scope,
    runProbe,
  );
  const second = dedupedAttendeeProbeMeTickets(
    'user-1',
    '__owner__',
    'bearer',
    scope,
    runProbe,
  );

  assert.equal(calls, 1);
  gate.resolve({ status: 'ok', body: { tickets: [] } });
  assert.deepEqual(await first, { status: 'ok', body: { tickets: [] } });
  assert.deepEqual(await second, { status: 'ok', body: { tickets: [] } });
});

test('dedupedAttendeeProbeMeTickets does not reuse probe across users', async () => {
  resetAttendeeProbeInflightForTests();
  let calls = 0;
  const runProbe = async () => {
    calls += 1;
    return { status: 'ok' as const, body: { tickets: [] } };
  };
  const scope = { kind: 'owner' as const };

  await dedupedAttendeeProbeMeTickets(
    'user-a',
    '__owner__',
    'bearer',
    scope,
    runProbe,
  );
  await dedupedAttendeeProbeMeTickets(
    'user-b',
    '__owner__',
    'bearer',
    scope,
    runProbe,
  );

  assert.equal(calls, 2);
});

test('dedupedAttendeeProbeMeTickets clears in-flight entry after settle', async () => {
  resetAttendeeProbeInflightForTests();
  let calls = 0;
  const runProbe = async () => {
    calls += 1;
    return { status: 'unauthorized' as const };
  };
  const scope = { kind: 'tenant' as const, tenantId: 't-1' };

  await dedupedAttendeeProbeMeTickets(
    'user-1',
    't-1',
    'bearer',
    scope,
    runProbe,
  );
  await dedupedAttendeeProbeMeTickets(
    'user-1',
    't-1',
    'bearer',
    scope,
    runProbe,
  );

  assert.equal(calls, 2);
});

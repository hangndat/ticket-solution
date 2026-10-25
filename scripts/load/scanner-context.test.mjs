import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scannerContextSummary, interleaveEventJobs } from './scanner-context.mjs';

// Unsigned fixture claims only: the production API verifies real tokens in the
// integration smoke. This test validates workload construction, not JWT auth.
const token = sub => `fixture.${Buffer.from(JSON.stringify({ iss: 'fixture', sub })).toString('base64url')}.fixture`;
const scanner = (user, session = user) => ({ userId: user, sessionId: session, token: token(user) });

test('rejects many sessions sharing one identity (original benchmark failure)', () => {
  const contexts = { a: [scanner('one', 's1'), scanner('one', 's2')] };
  assert.throws(() => scannerContextSummary(contexts, ['a'], 2), /distinct identity/);
});

test('rejects distinct DB users backed by the same OIDC subject', () => {
  const contexts = { a: [scanner('one'), { ...scanner('two'), token: token('one') }] };
  assert.throws(() => scannerContextSummary(contexts, ['a'], 2), /distinct identity/);
});

test('accepts distinct identities and reports no token material', () => {
  const contexts = { a: [scanner('a1'), scanner('a2')], b: [scanner('b1'), scanner('b2')] };
  assert.deepEqual(scannerContextSummary(contexts, ['a', 'b'], 2), {
    model: 'one-identity-per-scanner', distinctIdentities: 4, distinctUsers: 4,
    distinctSessions: 4, events: 2, scannersPerEvent: 2,
  });
});

test('interleaves events without losing or duplicating jobs', () => {
  const jobs = [
    { eventId: 'a', ticket: 1 }, { eventId: 'a', ticket: 2 }, { eventId: 'a', ticket: 3 },
    { eventId: 'b', ticket: 4 }, { eventId: 'b', ticket: 5 },
  ];
  assert.deepEqual(interleaveEventJobs(jobs), [jobs[0], jobs[3], jobs[1], jobs[4], jobs[2]]);
  assert.deepEqual(interleaveEventJobs([]), []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeBffMeSession } from '../src/oidc/session-summary';

test('summarizeBffMeSession maps upstream outage to guided copy', () => {
  const summary = summarizeBffMeSession(
    502,
    JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'x' }),
  );
  assert.equal(summary.kind, 'error');
  if (summary.kind === 'error') {
    assert.match(summary.detail, /API/i);
    assert.match(summary.detail, /localhost/i);
  }
});

test('summarizeBffMeSession signed-in from email', () => {
  const summary = summarizeBffMeSession(
    200,
    JSON.stringify({ email: 'attendee@example.com' }),
  );
  assert.deepEqual(summary, {
    kind: 'signed-in',
    subjectHint: 'attendee@example.com',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARCHIVED_DEMO_EVENTS,
  demoEventHref,
  formatEventDate,
} from '../src/events';

test('archived fixtures stay off the public SoT path (reference only)', () => {
  assert.equal(ARCHIVED_DEMO_EVENTS.length, 2);
  for (const event of ARCHIVED_DEMO_EVENTS) {
    assert.ok(event.id.startsWith('fixture-'));
    assert.equal(
      demoEventHref(event),
      `/t/${event.tenantSlug}/events/${event.slug}`,
    );
  }
});

test('formatEventDate helper still formats archived reference timestamps', () => {
  const event = ARCHIVED_DEMO_EVENTS[0]!;
  assert.match(formatEventDate(event), /12 December 2026/);
  assert.match(formatEventDate(event), /09:00/);
  assert.match(formatEventDate({ ...event, timezone: 'UTC' }), /02:00/);
});

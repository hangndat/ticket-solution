import assert from 'node:assert/strict';
import test from 'node:test';
import {
  demoEventHref,
  demoEventRoutes,
  findDemoEvent,
  formatEventDate,
} from '../src/events';

test('every published fixture resolves only within its own tenant', () => {
  const routes = demoEventRoutes();
  assert.equal(routes.length, 2);
  for (const route of routes) {
    const event = findDemoEvent(route.tenantSlug, route.eventSlug);
    assert.ok(event);
    assert.equal(event.tenantSlug, route.tenantSlug);
    assert.equal(event.slug, route.eventSlug);
    assert.equal(
      demoEventHref(event),
      `/t/${route.tenantSlug}/events/${route.eventSlug}`,
    );
    for (const other of routes.filter(
      (value) => value.tenantSlug !== route.tenantSlug,
    )) {
      assert.equal(findDemoEvent(other.tenantSlug, route.eventSlug), undefined);
    }
  }
});

test('unknown, malformed and prototype-like slugs never select fallback content', () => {
  for (const tenant of [
    'unknown',
    '',
    'MFEST',
    'constructor',
    '__proto__',
    '../mfest',
  ]) {
    assert.equal(findDemoEvent(tenant, 'mfest-2026'), undefined);
  }
  for (const event of [
    'unknown',
    '',
    'constructor',
    '__proto__',
    'MFEST-2026',
  ]) {
    assert.equal(findDemoEvent('mfest', event), undefined);
  }
});

test('interleaved tenant requests retain independent branding and event content', () => {
  const a = findDemoEvent('mfest', 'mfest-2026')!;
  const b = findDemoEvent('northline', 'form-forum-2026')!;
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.brand.organizationName, b.brand.organizationName);
  assert.notEqual(a.brand.primaryColor, b.brand.primaryColor);
  assert.notEqual(a.location, b.location);
  assert.equal(findDemoEvent('mfest', 'mfest-2026'), a);
  assert.equal(findDemoEvent('northline', 'form-forum-2026'), b);
});

test('event date uses its declared timezone regardless of server timezone', () => {
  const event = findDemoEvent('mfest', 'mfest-2026')!;
  assert.match(formatEventDate(event), /12 December 2026/);
  assert.match(formatEventDate(event), /09:00/);
  assert.match(formatEventDate({ ...event, timezone: 'UTC' }), /02:00/);
});

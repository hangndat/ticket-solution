import assert from 'node:assert/strict';
import test from 'node:test';
import {
  derivePrepReadiness,
  readinessAllOk,
  readinessSummary,
} from '../src/prep/readiness';
import {
  buildMinimalConfigPayload,
  hasTermsContent,
  isMinimalBrandOk,
} from '../src/prep/default-config';
import { DEFAULT_TENANT_PRIMARY_COLOR } from '../src/theme/vemoki';
import {
  buildCreateEventUpstreamBody,
  isEventVisibility,
} from '../src/prep/create-event-body';

test('readiness stays unknown without event context', () => {
  const items = derivePrepReadiness({
    hasEventContext: false,
    hasTicketType: true,
    hasSource: true,
    quotaKnown: true,
    quotaCapacity: 10,
    hasTermsOrPublished: true,
    hasBrand: true,
  });
  assert.ok(items.every((i) => i.status === 'unknown'));
  assert.equal(readinessAllOk(items), false);
});

test('readinessAllOk only when every gate is ok', () => {
  const ok = derivePrepReadiness({
    hasEventContext: true,
    hasTicketType: true,
    hasSource: true,
    quotaKnown: true,
    quotaCapacity: null,
    hasTermsOrPublished: true,
    hasBrand: true,
  });
  assert.equal(readinessAllOk(ok), true);
  assert.match(readinessSummary(ok), /Publish ≠ mở redeem ≠ mở Gate/);

  const missing = derivePrepReadiness({
    hasEventContext: true,
    hasTicketType: false,
    hasSource: true,
    quotaKnown: true,
    quotaCapacity: 5,
    hasTermsOrPublished: true,
    hasBrand: true,
  });
  assert.equal(readinessAllOk(missing), false);
  assert.match(readinessSummary(missing), /Loại vé/);
});

test('minimal config payload has brand + terms', () => {
  const payload = buildMinimalConfigPayload({
    organizationName: 'Vemoki',
    primaryColor: DEFAULT_TENANT_PRIMARY_COLOR,
    termsText: 'Điều khoản demo',
  });
  assert.equal(isMinimalBrandOk(payload), true);
  assert.equal(hasTermsContent(payload), true);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.brand.primaryColor, DEFAULT_TENANT_PRIMARY_COLOR);
});

test('create event body allowlists visibility and venue pair', () => {
  assert.equal(isEventVisibility('PUBLIC'), true);
  assert.equal(isEventVisibility('SECRET'), false);
  const body = buildCreateEventUpstreamBody({
    slug: 'demo',
    name: 'Demo',
    visibility: 'PUBLIC',
    venueName: 'Hall',
    venueAddress: '1 Street',
    contactEmail: 'ops@example.com',
  });
  assert.equal(body.slug, 'demo');
  assert.deepEqual(body.venue, { name: 'Hall', address: '1 Street' });
  assert.equal(body.contact?.email, 'ops@example.com');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { overviewWorkItems } from '../src/ops/overview-work';
import type { ShownPortfolioItem } from '../src/ops/portfolio';

const tenantId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';

const shown = (over: Partial<ShownPortfolioItem> = {}): ShownPortfolioItem => ({
  kind: 'shown',
  eventId,
  title: 'Demo',
  checkInSuccessCount: 0,
  pendingApprovalCount: 0,
  emailNeedsCsCount: 0,
  quotaRemaining: 4,
  quotaCapacityState: 'FINITE',
  rejectByReason: {},
  ...over,
});

test('empty org points to create-event when permitted', () => {
  const items = overviewWorkItems({
    tenantId,
    tenantPermissions: ['event.create'],
    events: [],
    portfolioItems: [],
  });
  assert.deepEqual(items.map((i) => i.stage), ['prep']);
  assert.equal(items[0]?.href, `/t/${tenantId}/events/new`);
});

test('pending and CS cards keep event context and skip gate lock', () => {
  const items = overviewWorkItems({
    tenantId,
    tenantPermissions: ['event.list'],
    events: [
      {
        tenantId,
        eventId,
        name: 'Demo',
        permissions: ['redemption.approve', 'cs.lookup', 'report.read', 'inventory.import'],
      },
    ],
    portfolioItems: [
      shown({ pendingApprovalCount: 2, emailNeedsCsCount: 1, quotaRemaining: 0 }),
    ],
  });
  const hrefs = items.map((i) => i.href);
  assert.ok(hrefs.some((h) => h.includes(`/guests#pending`)));
  assert.ok(hrefs.some((h) => h.includes(`/support#cs`)));
  assert.ok(hrefs.some((h) => h.endsWith('/quota')));
  assert.equal(
    items.every((i) => i.href.includes(eventId) || i.href.includes(tenantId)),
    true,
  );
});

test('missing event permission omits that card instead of inventing a path', () => {
  const items = overviewWorkItems({
    tenantId,
    tenantPermissions: [],
    events: [
      {
        tenantId,
        eventId,
        name: 'Demo',
        permissions: ['event.update'],
      },
    ],
    portfolioItems: [shown({ pendingApprovalCount: 3 })],
  });
  assert.equal(items.some((i) => i.titleKey === 'overview.work.issuePending'), false);
  assert.ok(items.some((i) => i.href.endsWith('/setup')));
});

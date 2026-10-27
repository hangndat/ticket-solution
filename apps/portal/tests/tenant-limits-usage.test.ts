import assert from 'node:assert/strict';
import test from 'node:test';
import {
  displayedSnapshotAsOf,
  formatConfiguredCap,
  interpretTenantLimitsUsage,
} from '../src/ops/tenant-limits-usage';
import { isReportDataStale } from '../src/ops/report';

const asOf = '2026-10-27T04:00:00.000Z';
const ok = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  limits: {
    maxEvents: 3,
    maxStaff: null,
    emailPerDay: 20,
    importRowsPerJob: 500,
  },
  usage: {
    events: 1,
    staffActive: 2,
    staffPendingInvites: 0,
    emailToday: 4,
  },
  asOf,
  emailUsageDate: '2026-10-27',
};

test('parses a complete server snapshot', () => {
  const view = interpretTenantLimitsUsage(200, ok, false);
  assert.equal(view.kind, 'shown');
  if (view.kind !== 'shown') return;
  assert.equal(view.snapshot.asOf, asOf);
  assert.equal(view.snapshot.limits.maxStaff, null);
  assert.equal(formatConfiguredCap(null, 'en'), 'No configured cap');
  assert.doesNotMatch(formatConfiguredCap(null, 'en'), /unlimited/i);
});

test('timer does not move displayed asOf; only a new snapshot would', () => {
  const later = Date.parse(asOf) + 10 * 60_000;
  assert.equal(displayedSnapshotAsOf(asOf), asOf);
  assert.equal(isReportDataStale(asOf, later), true);
  assert.equal(isReportDataStale(asOf, Date.parse(asOf) + 60_000), false);
});

test('incomplete or failed reads stay unknown — never fake usage', () => {
  assert.equal(interpretTenantLimitsUsage(500, ok, false).kind, 'unknown');
  assert.equal(interpretTenantLimitsUsage(200, { ...ok, asOf: 'nope' }, false).kind, 'unknown');
  assert.equal(interpretTenantLimitsUsage(403, { code: 'PERMISSION_DENIED' }, false).kind, 'forbidden');
});

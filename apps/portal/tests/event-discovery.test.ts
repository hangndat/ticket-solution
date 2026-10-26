import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShellLoadState } from '../src/nav/load-shell-context';
import {
  refreshUntilEventAssigned,
  shouldRefreshEventDiscovery,
} from '../src/prep/event-discovery';

const tenantId = '11111111-1111-4111-8111-111111111111';
const eventId = '31bba69d-fdaa-4ce2-ba65-d34dddacbfe7';

function readyShell(events: { tenantId: string; eventId: string }[]): ShellLoadState {
  return {
    status: 'ready',
    caps: { showOrgChrome: true, showPlatform: false, staffEligible: true },
    meTenants: {
      items: [
        {
          tenantId,
          slug: 'demo',
          name: 'Demo',
          status: 'ACTIVE',
          role: 'Owner',
          tenantPermissions: ['event.create'],
        },
      ],
    },
    meEvents: {
      staffEligible: true,
      items: events.map((e) => ({
        tenantId: e.tenantId,
        eventId: e.eventId,
        name: 'Event',
        permissions: ['event.read'],
      })),
    },
    platformMe: null,
    http: { tenants: 200, events: 200, platform: 401 },
  };
}

test('shouldRefreshEventDiscovery when path event missing from MeEvents after create', () => {
  const shell = readyShell([]);
  assert.equal(shouldRefreshEventDiscovery(shell, tenantId, eventId), true);
});

test('shouldRefreshEventDiscovery false when assignment already in MeEvents', () => {
  const shell = readyShell([{ tenantId, eventId }]);
  assert.equal(shouldRefreshEventDiscovery(shell, tenantId, eventId), false);
});

test('shouldRefreshEventDiscovery false while shell not ready', () => {
  assert.equal(
    shouldRefreshEventDiscovery({ status: 'loading' }, tenantId, eventId),
    false,
  );
});

test('refreshUntilEventAssigned retries until MeEvents contains the new assignment', async () => {
  let calls = 0;
  const result = await refreshUntilEventAssigned(tenantId, eventId, async () => {
    calls += 1;
    return calls < 3 ? readyShell([]) : readyShell([{ tenantId, eventId }]);
  });
  assert.equal(calls, 3);
  assert.equal(shouldRefreshEventDiscovery(result, tenantId, eventId), false);
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import {
  parsePortalContextCache,
  portalContextStorageKey,
  readPortalContextCache,
  resolveHomeDestination,
  validatePortalContextCache,
  writePortalContextCache,
  persistPortalContextFromRoute,
} from '../src/context-cache';

const userA = 'user-aaa';
const userB = 'user-bbb';
const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const eventA1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventB1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

const activeOwner = (tenantId: string, slug: string): MeTenantItem => ({
  tenantId,
  slug,
  name: slug,
  status: 'ACTIVE',
  role: 'Owner',
  tenantPermissions: ['event.create', 'event.list', 'tenant.profile'],
});

const pendingOwner = (tenantId: string): MeTenantItem => ({
  tenantId,
  slug: 'pending',
  name: 'Pending',
  status: 'PENDING',
  role: 'Owner',
  tenantPermissions: ['tenant.profile'],
});

const eventRow = (
  tenantId: string,
  eventId: string,
): MeEventItem => ({
  tenantId,
  eventId,
  name: 'E',
  permissions: ['event.read'],
});

describe('portal context cache — storage', () => {
  it('keys by verified userId only', () => {
    assert.equal(
      portalContextStorageKey(userA),
      `portal:context:v1:${userA}`,
    );
    const storage = memoryStorage();
    writePortalContextCache(
      userA,
      {
        version: 1,
        tenantId: tenantA,
        eventByTenant: {},
        portalUsedTenants: [],
      },
      storage,
    );
    assert.equal(readPortalContextCache(userB, storage).tenantId, null);
    assert.equal(readPortalContextCache(userA, storage).tenantId, tenantA);
  });

  it('malformed JSON returns empty cache', () => {
    const storage = memoryStorage();
    storage.setItem(portalContextStorageKey(userA), '{not-json');
    assert.equal(readPortalContextCache(userA, storage).tenantId, null);
  });

  it('rejects wrong schema version', () => {
    const parsed = parsePortalContextCache({
      version: 99,
      tenantId: tenantA,
      eventByTenant: {},
      portalUsedTenants: [],
    });
    assert.equal(parsed.tenantId, null);
  });
});

describe('portal context cache — validation', () => {
  const tenants = [activeOwner(tenantA, 'a'), activeOwner(tenantB, 'b')];
  const events = [eventRow(tenantA, eventA1), eventRow(tenantB, eventB1)];

  it('drops stale event but keeps ACTIVE tenant', () => {
    const validated = validatePortalContextCache({
      cache: {
        version: 1,
        tenantId: tenantA,
        eventByTenant: { [tenantA]: 'dead-event-id' },
        portalUsedTenants: [],
      },
      tenants,
      events,
    });
    assert.deepEqual(validated, { tenantId: tenantA, eventId: null });
  });

  it('rejects PENDING tenant from cache', () => {
    const validated = validatePortalContextCache({
      cache: {
        version: 1,
        tenantId: tenantA,
        eventByTenant: {},
        portalUsedTenants: [],
      },
      tenants: [pendingOwner(tenantA)],
      events: [],
    });
    assert.equal(validated, null);
  });

  it('does not apply another tenant event to tenant switch', () => {
    const validated = validatePortalContextCache({
      cache: {
        version: 1,
        tenantId: tenantB,
        eventByTenant: { [tenantA]: eventA1 },
        portalUsedTenants: [],
      },
      tenants,
      events,
    });
    assert.deepEqual(validated, { tenantId: tenantB, eventId: null });
  });
});

describe('portal context cache — home resolution', () => {
  const tenants = [activeOwner(tenantA, 'a')];
  const events = [eventRow(tenantA, eventA1)];

  it('prefers valid cache before first-run onboarding', () => {
    const dest = resolveHomeDestination({
      userId: userA,
      tenants,
      events,
      cache: {
        version: 1,
        tenantId: tenantA,
        eventByTenant: { [tenantA]: eventA1 },
        portalUsedTenants: [],
      },
    });
    assert.equal(dest.kind, 'redirect');
    if (dest.kind === 'redirect') {
      assert.equal(
        dest.path,
        `/t/${tenantA}/e/${eventA1}`,
      );
    }
  });

  it('skips first-run when portal was used via /t', () => {
    const dest = resolveHomeDestination({
      userId: userA,
      tenants,
      events: [],
      cache: {
        version: 1,
        tenantId: tenantA,
        eventByTenant: {},
        portalUsedTenants: [tenantA],
      },
    });
    assert.equal(dest.kind, 'redirect');
    if (dest.kind === 'redirect') {
      assert.equal(dest.path, `/t/${tenantA}`);
    }
  });

  it('PENDING still routes to onboarding wait', () => {
    const dest = resolveHomeDestination({
      userId: userA,
      tenants: [pendingOwner(tenantA)],
      events: [],
      cache: null,
    });
    assert.equal(dest.kind, 'redirect');
    if (dest.kind === 'redirect') {
      assert.equal(dest.path, `/onboarding/${tenantA}`);
    }
  });
});

describe('portal context cache — persist from route', () => {
  const tenants = [activeOwner(tenantA, 'a')];
  const events = [eventRow(tenantA, eventA1)];
  const storage = memoryStorage();

  it('records event selection and clears on org home', () => {
    persistPortalContextFromRoute({
      userId: userA,
      pathname: `/t/${tenantA}/e/${eventA1}/setup`,
      tenants,
      events,
      storage,
    });
    let cache = readPortalContextCache(userA, storage);
    assert.equal(cache.eventByTenant[tenantA], eventA1);

    persistPortalContextFromRoute({
      userId: userA,
      pathname: `/t/${tenantA}`,
      tenants,
      events,
      storage,
    });
    cache = readPortalContextCache(userA, storage);
    assert.equal(cache.eventByTenant[tenantA], null);
  });

  it('keeps event on org subroutes without /e/', () => {
    writePortalContextCache(
      userA,
      {
        version: 1,
        tenantId: tenantA,
        eventByTenant: { [tenantA]: eventA1 },
        portalUsedTenants: [],
      },
      storage,
    );
    persistPortalContextFromRoute({
      userId: userA,
      pathname: `/t/${tenantA}/members`,
      tenants,
      events,
      storage,
    });
    const cache = readPortalContextCache(userA, storage);
    assert.equal(cache.eventByTenant[tenantA], eventA1);
  });

  it('marks portal used for ACTIVE tenant path', () => {
    persistPortalContextFromRoute({
      userId: userA,
      pathname: `/t/${tenantA}/analytics`,
      tenants,
      events,
      storage,
    });
    const cache = readPortalContextCache(userA, storage);
    assert.ok(cache.portalUsedTenants.includes(tenantA));
  });
});

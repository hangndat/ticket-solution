import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FILTER_ALLOWLIST,
  detectStaleView,
  listViewsForSurface,
  parseSavedViewsStore,
  sanitizeSavedViewPayload,
  savedViewsStorageKey,
  upsertSavedView,
  writeSavedViewsStore,
  readSavedViewsStore,
  SAVED_VIEWS_SCHEMA_VERSION,
  type SavedViewRecord,
} from '../src/views';

const userA = 'user-aaa';
const userB = 'user-bbb';
const tenant = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const sourceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
  };
}

describe('P2a saved views — allowlist + isolation (AC-B1/B2, AC-PS2)', () => {
  it('storage key scopes by userId + tenantId', () => {
    assert.equal(
      savedViewsStorageKey(userA, tenant),
      `vemoki_portal_saved_views_v1:${userA}:${tenant}`,
    );
    assert.notEqual(
      savedViewsStorageKey(userA, tenant),
      savedViewsStorageKey(userB, tenant),
    );
  });

  it('sanitizes pending filters to UUID allowlist; drops unknown keys', () => {
    const ok = sanitizeSavedViewPayload('pending', {
      filters: {
        sourceId,
        ticketTypeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        q: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        evil: 'drop-me',
        rawEmail: 'a@b.c',
      },
    });
    assert.equal(ok.stale, true);
    assert.deepEqual(Object.keys(ok.filters).sort(), [
      'q',
      'sourceId',
      'ticketTypeId',
    ]);
    assert.equal(ok.filters.evil, undefined);
  });

  it('never persists codes raw lookup q', () => {
    assert.ok(!FILTER_ALLOWLIST.codes.includes('q'));
    const result = sanitizeSavedViewPayload('codes', {
      filters: {
        state: 'AVAILABLE',
        q: 'secret-raw-code',
        sourceId,
      },
    });
    assert.equal(result.filters.q, undefined);
    assert.equal(result.filters.state, 'AVAILABLE');
    assert.equal(result.stale, true);
  });

  it('marks stale when stored view carries deprecated filter field', () => {
    const view: SavedViewRecord = {
      schemaVersion: SAVED_VIEWS_SCHEMA_VERSION,
      id: 'v1',
      name: 'Old',
      surface: 'pending',
      scope: 'event',
      eventId,
      filters: { sourceId, legacyField: 'x' } as Record<string, string>,
      sort: null,
      columns: [],
      isDefault: false,
      updatedAt: '2026-10-19T00:00:00.000Z',
    };
    // detectStaleView re-sanitizes; legacy key already stripped on parse —
    // simulate by checking sanitize on raw payload.
    const sanitized = sanitizeSavedViewPayload('pending', {
      filters: { sourceId, legacyField: 'x' },
    });
    assert.equal(sanitized.stale, true);
    assert.equal(sanitized.filters.sourceId, sourceId);
    assert.equal(detectStaleView({ ...view, filters: sanitized.filters }), false);
  });

  it('U1 views are invisible to U2 on same tenant (AC-B2 private)', () => {
    const store = memoryStorage();
    (globalThis as { localStorage?: typeof store }).localStorage = store;

    const record: SavedViewRecord = {
      schemaVersion: SAVED_VIEWS_SCHEMA_VERSION,
      id: 'view-1',
      name: 'Đang duyệt',
      surface: 'pending',
      scope: 'event',
      eventId,
      filters: { sourceId },
      sort: null,
      columns: [],
      isDefault: true,
      updatedAt: '2026-10-19T00:00:00.000Z',
    };
    writeSavedViewsStore(
      userA,
      tenant,
      upsertSavedView(
        { schemaVersion: SAVED_VIEWS_SCHEMA_VERSION, views: [] },
        record,
      ),
    );

    const forA = listViewsForSurface(
      readSavedViewsStore(userA, tenant),
      'pending',
      eventId,
    );
    const forB = listViewsForSurface(
      readSavedViewsStore(userB, tenant),
      'pending',
      eventId,
    );
    assert.equal(forA.length, 1);
    assert.equal(forA[0]?.name, 'Đang duyệt');
    assert.equal(forB.length, 0);

    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('parseSavedViewsStore drops corrupt / wrong schema', () => {
    const empty = parseSavedViewsStore({ schemaVersion: 99, views: [{}] });
    assert.equal(empty.views.length, 0);
    const ok = parseSavedViewsStore({
      schemaVersion: 1,
      views: [
        {
          schemaVersion: 1,
          id: 'x',
          name: 'OK',
          surface: 'exports',
          scope: 'org',
          eventId: null,
          filters: { status: 'READY' },
          sort: null,
          columns: [],
          isDefault: false,
          updatedAt: '2026-10-19T00:00:00.000Z',
        },
      ],
    });
    assert.equal(ok.views.length, 1);
    assert.equal(ok.views[0]?.filters.status, 'READY');
  });
});

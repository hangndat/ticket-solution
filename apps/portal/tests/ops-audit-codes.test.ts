import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAuditQuery,
  interpretAuditPage,
  interpretPlatformAuditPage,
} from '../src/ops/audit';
import { buildCodesQuery, interpretCodesPage } from '../src/ops/codes';
import {
  buildPlatformListQuery,
  interpretPlatformTenantsPage,
} from '../src/ops/platform-zone';

const entry = {
  auditId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actorUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  action: 'event.publish',
  resourceType: 'event',
  resourceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  operationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  createdAt: '2026-10-18T12:00:00.000Z',
};

describe('audit interpreters (H-A1 / H-P-AUDIT)', () => {
  it('accepts allowlisted event audit page', () => {
    const view = interpretAuditPage(
      200,
      { items: [entry], nextCursor: null },
      false,
    );
    assert.equal(view.kind, 'page');
    if (view.kind === 'page') {
      assert.equal(view.page.items.length, 1);
      assert.equal(view.page.items[0]?.action, 'event.publish');
    }
  });

  it('rejects reason / sanitizedDiff leakage', () => {
    const view = interpretAuditPage(
      200,
      {
        items: [{ ...entry, reason: 'secret' }],
        nextCursor: null,
      },
      false,
    );
    assert.equal(view.kind, 'unknown');
  });

  it('rejects fabricated total', () => {
    const view = interpretAuditPage(
      200,
      { items: [entry], nextCursor: null, total: 99 },
      false,
    );
    assert.equal(view.kind, 'unknown');
  });

  it('maps 403 without inventing success', () => {
    const view = interpretAuditPage(
      403,
      { code: 'FORBIDDEN', message: 'nope' },
      false,
    );
    assert.equal(view.kind, 'rejected');
  });

  it('platform audit requires tenantId field shape and rejects reason', () => {
    const ok = interpretPlatformAuditPage(
      200,
      {
        items: [
          {
            auditId: entry.auditId,
            actorUserId: entry.actorUserId,
            action: 'tenant.create',
            resourceType: 'tenant',
            resourceId: entry.resourceId,
            tenantId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            createdAt: entry.createdAt,
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(ok.kind, 'page');

    const bad = interpretPlatformAuditPage(
      200,
      {
        items: [
          {
            auditId: entry.auditId,
            actorUserId: null,
            action: 'x',
            resourceType: 'tenant',
            resourceId: null,
            tenantId: null,
            createdAt: entry.createdAt,
            sanitizedDiff: {},
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(bad.kind, 'unknown');
  });

  it('buildAuditQuery omits empty filters', () => {
    assert.equal(buildAuditQuery({}), '');
    assert.match(
      buildAuditQuery({ action: 'a', from: '2026-01-01T00:00:00Z' }),
      /action=a/,
    );
  });
});

describe('codes interpreter (H-C1)', () => {
  const code = {
    codeId: '11111111-1111-4111-8111-111111111111',
    state: 'AVAILABLE' as const,
    sourceId: '22222222-2222-4222-8222-222222222222',
    ticketTypeId: '33333333-3333-4333-8333-333333333333',
  };

  it('accepts masked summary', () => {
    const view = interpretCodesPage(
      200,
      { items: [code], nextCursor: 'c1' },
      false,
    );
    assert.equal(view.kind, 'page');
  });

  it('rejects hmac / raw / echoed q', () => {
    assert.equal(
      interpretCodesPage(
        200,
        { items: [{ ...code, codeHmac: 'x' }], nextCursor: null },
        false,
      ).kind,
      'unknown',
    );
    assert.equal(
      interpretCodesPage(
        200,
        { items: [code], nextCursor: null, q: 'SECRET' },
        false,
      ).kind,
      'unknown',
    );
  });

  it('buildCodesQuery can include q without putting it in response parser', () => {
    assert.match(buildCodesQuery({ q: 'abc' }), /q=abc/);
  });
});

describe('platform tenants (H-P1)', () => {
  it('accepts summary projection', () => {
    const view = interpretPlatformTenantsPage(
      200,
      {
        items: [
          {
            tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            slug: 'acme',
            name: 'Acme',
            status: 'ACTIVE',
            version: 1,
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(view.kind, 'page');
  });

  it('rejects limits / billing leakage', () => {
    const view = interpretPlatformTenantsPage(
      200,
      {
        items: [
          {
            tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            slug: 'acme',
            name: 'Acme',
            status: 'ACTIVE',
            version: 1,
            createdAt: '2026-10-01T00:00:00.000Z',
            limits: { seats: 9 },
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(view.kind, 'unknown');
  });

  it('buildPlatformListQuery supports cursor', () => {
    assert.match(buildPlatformListQuery({ cursor: 'x', limit: 10 }), /cursor=x/);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  interpretPlatformCreateTenant,
  interpretPlatformMutationOk,
  interpretPlatformSupportGrantCreate,
  interpretPlatformTenantDetail,
} from '../src/ops/platform-zone';

const DETAIL_SAMPLE = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  slug: 'acme',
  name: 'Acme',
  status: 'ACTIVE',
  defaultTimezone: 'Asia/Ho_Chi_Minh',
  contact: null,
  version: 2,
  limits: {
    maxEvents: null,
    maxStaff: 5,
    emailPerDay: null,
    importRowsPerJob: null,
  },
  flags: { importsEnabled: true, exportsEnabled: false },
  usage: {
    events: 1,
    staffActive: 2,
    staffPendingInvites: 0,
    emailToday: 3,
  },
};

describe('platform mutate zone', () => {
  it('interpretPlatformCreateTenant accepts 201', () => {
    const view = interpretPlatformCreateTenant(
      201,
      {
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        status: 'PENDING',
        version: 1,
        ownerInviteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      false,
    );
    assert.equal(view.kind, 'ok');
  });

  it('interpretPlatformTenantDetail accepts detail projection', () => {
    const view = interpretPlatformTenantDetail(200, DETAIL_SAMPLE, false);
    assert.equal(view.kind, 'ok');
    if (view.kind === 'ok') {
      assert.equal(view.detail.version, 2);
      assert.equal(view.detail.flags.exportsEnabled, false);
    }
  });

  it('interpretPlatformMutationOk treats 200 as ok', () => {
    const view = interpretPlatformMutationOk(200, {}, false);
    assert.equal(view.kind, 'ok');
  });

  it('interpretPlatformSupportGrantCreate accepts grant', () => {
    const view = interpretPlatformSupportGrantCreate(
      201,
      {
        grantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        tenantId: DETAIL_SAMPLE.tenantId,
        eventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        scopes: ['cs.read'],
        expiresAt: '2026-12-01T00:00:00.000Z',
      },
      false,
    );
    assert.equal(view.kind, 'ok');
  });

  it('fail-closed on operator deny', () => {
    const view = interpretPlatformTenantDetail(
      403,
      { code: 'PLATFORM_OPERATOR_REQUIRED', message: 'no' },
      false,
    );
    assert.equal(view.kind, 'rejected');
  });
});

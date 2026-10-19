import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PORTAL_UPSTREAM } from '../src/bff/paths';

const t = '11111111-1111-4111-8111-111111111111';
const e = '22222222-2222-4222-8222-222222222222';

describe('PORTAL_UPSTREAM ops paths', () => {
  it('covers import / invite / pending / notify / export', () => {
    assert.match(PORTAL_UPSTREAM.importsUpload(t, e), /\/imports\/files$/);
    assert.match(PORTAL_UPSTREAM.invitationDispatchPreview(t, e), /dispatch-preview$/);
    assert.match(PORTAL_UPSTREAM.redemptions(t, e), /\/redemptions$/);
    assert.match(
      PORTAL_UPSTREAM.redemptionApprove(t, e, '33333333-3333-4333-8333-333333333333'),
      /\/approve$/,
    );
    assert.match(PORTAL_UPSTREAM.notifications(t, e), /\/notifications$/);
    assert.match(
      PORTAL_UPSTREAM.exportDownload(t, e, '44444444-4444-4444-8444-444444444444'),
      /\/download$/,
    );
  });

  it('covers audit / codes / portfolio / platform zone upstreams', () => {
    assert.match(PORTAL_UPSTREAM.audit(t, e), /\/audit$/);
    assert.match(PORTAL_UPSTREAM.codes(t, e), /\/codes$/);
    assert.equal(
      PORTAL_UPSTREAM.portfolio(t),
      `/v1/tenants/${t}/reports/portfolio`,
    );
    assert.equal(
      PORTAL_UPSTREAM.tenantRegistrations,
      '/v1/public/tenant-registrations',
    );
    assert.equal(
      PORTAL_UPSTREAM.rolePresets(t),
      `/v1/tenants/${t}/role-presets`,
    );
    assert.equal(PORTAL_UPSTREAM.platformTenants, '/v1/platform/tenants');
    assert.equal(PORTAL_UPSTREAM.platformAudit, '/v1/platform/audit');
    assert.equal(
      PORTAL_UPSTREAM.platformTenantHealth(t),
      `/v1/platform/tenants/${t}/health`,
    );
    assert.equal(
      PORTAL_UPSTREAM.platformSupportGrantRevoke(t),
      `/v1/platform/support-grants/${t}/revoke`,
    );
  });

  it('covers role-presets + member role PATCH (P2-ROLES-PRESET)', () => {
    const m = '33333333-3333-4333-8333-333333333333';
    const p = '44444444-4444-4444-8444-444444444444';
    assert.equal(PORTAL_UPSTREAM.rolePresets(t), `/v1/tenants/${t}/role-presets`);
    assert.equal(
      PORTAL_UPSTREAM.rolePreset(t, p),
      `/v1/tenants/${t}/role-presets/${p}`,
    );
    assert.equal(
      PORTAL_UPSTREAM.memberRole(t, m),
      `/v1/tenants/${t}/members/${m}/role`,
    );
  });
});

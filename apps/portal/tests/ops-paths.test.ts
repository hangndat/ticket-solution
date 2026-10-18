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
});

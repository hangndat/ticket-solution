import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isTenantOrgHomePath,
  parsePathEventId,
  resolveShellEffectiveEventId,
  routeAfterEventSelectChange,
} from '../src/nav/portal-context-routes';

const tenant = '11111111-1111-4111-8111-111111111111';
const event = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('portal context routes — event select navigation', () => {
  it('clear (undefined) routes to org home only', () => {
    assert.equal(
      routeAfterEventSelectChange(tenant, undefined),
      `/t/${tenant}`,
    );
  });

  it('clear (empty) routes to org home only', () => {
    assert.equal(routeAfterEventSelectChange(tenant, ''), `/t/${tenant}`);
  });

  it('selection routes to explicit event path', () => {
    assert.equal(
      routeAfterEventSelectChange(tenant, event),
      `/t/${tenant}/e/${event}`,
    );
  });

  it('missing tenant yields no navigation', () => {
    assert.equal(routeAfterEventSelectChange('', event), null);
  });
});

describe('portal context routes — path parsing', () => {
  it('rejects undefined segment from bad navigation', () => {
    assert.equal(
      parsePathEventId(`/t/${tenant}/e/undefined`),
      null,
    );
  });

  it('reads valid event segment', () => {
    assert.equal(parsePathEventId(`/t/${tenant}/e/${event}`), event);
  });
});

describe('portal context routes — shell effective event', () => {
  it('org home does not resurrect cache after clear', () => {
    assert.equal(
      resolveShellEffectiveEventId(`/t/${tenant}`, event),
      null,
    );
  });

  it('org subroute keeps validated cache context', () => {
    assert.equal(
      resolveShellEffectiveEventId(`/t/${tenant}/members`, event),
      event,
    );
  });

  it('explicit /e/ path wins over cache', () => {
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    assert.equal(
      resolveShellEffectiveEventId(`/t/${tenant}/e/${other}`, event),
      other,
    );
  });

  it('isTenantOrgHomePath matches trailing slash', () => {
    assert.ok(isTenantOrgHomePath(`/t/${tenant}`));
    assert.ok(isTenantOrgHomePath(`/t/${tenant}/`));
    assert.ok(!isTenantOrgHomePath(`/t/${tenant}/members`));
  });
});

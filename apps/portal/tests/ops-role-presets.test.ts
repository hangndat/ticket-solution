import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SYSTEM_MEMBERSHIP_ROLES,
  asRolePresetItems,
  buildRoleCatalogRows,
  inviteRoleFromUnknown,
  parseRoleSelectValue,
  roleLabel,
  rolePresetsUpstreamPath,
  roleSelectValue,
} from '../src/ops/role-presets';

const presetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('inviteRoleFromUnknown', () => {
  it('accepts built-in MembershipRole', () => {
    assert.equal(inviteRoleFromUnknown('Manager'), 'Manager');
    assert.equal(inviteRoleFromUnknown('Owner'), 'Owner');
  });

  it('accepts { presetId } only', () => {
    assert.deepEqual(inviteRoleFromUnknown({ presetId }), { presetId });
  });

  it('rejects client permission arrays (AC-D1 no composer tick)', () => {
    assert.equal(
      inviteRoleFromUnknown({
        presetId,
        tenantPermissions: ['members.manage'],
      }),
      null,
    );
    assert.equal(
      inviteRoleFromUnknown({
        name: 'CS+Report',
        tenantPermissions: ['report.read'],
        eventPermissions: [],
      }),
      null,
    );
    assert.equal(inviteRoleFromUnknown({ permissions: ['x'] }), null);
  });

  it('rejects unknown strings and empty objects', () => {
    assert.equal(inviteRoleFromUnknown('Custom'), null);
    assert.equal(inviteRoleFromUnknown({}), null);
    assert.equal(inviteRoleFromUnknown(null), null);
  });
});

describe('role select encode/decode', () => {
  it('round-trips system and preset', () => {
    assert.equal(roleSelectValue('CS'), 'CS');
    assert.equal(roleSelectValue({ presetId }), `preset:${presetId}`);
    assert.deepEqual(parseRoleSelectValue('Scanner'), 'Scanner');
    assert.deepEqual(parseRoleSelectValue(`preset:${presetId}`), { presetId });
    assert.deepEqual(parseRoleSelectValue(presetId), { presetId });
  });
});

describe('buildRoleCatalogRows', () => {
  it('lists system roles plus presets with member counts', () => {
    const rows = buildRoleCatalogRows(
      [
        {
          presetId,
          tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'CS+Report',
          schemaVersion: 1,
          tenantPermissions: ['members.manage'],
          eventPermissions: ['report.read'],
          createdAt: '2026-10-19T00:00:00.000Z',
        },
      ],
      ['Owner', 'Owner', presetId, 'Manager'],
    );
    assert.equal(rows.length, SYSTEM_MEMBERSHIP_ROLES.length + 1);
    const owner = rows.find((r) => r.key === 'Owner');
    assert.equal(owner?.kind, 'system');
    assert.equal(owner?.memberCount, 2);
    const preset = rows.find((r) => r.key === presetId);
    assert.equal(preset?.kind, 'preset');
    assert.equal(preset?.name, 'CS+Report');
    assert.equal(preset?.memberCount, 1);
    assert.equal(preset?.schemaVersion, 1);
  });
});

describe('asRolePresetItems / labels / upstream path', () => {
  it('parses list envelope and labels preset ids', () => {
    const items = asRolePresetItems({
      items: [
        {
          presetId,
          tenantId: null,
          name: 'Ops Lite',
          schemaVersion: 2,
          tenantPermissions: [],
          eventPermissions: ['gate.confirm'],
          createdAt: '2026-10-19T01:00:00.000Z',
        },
        { presetId: 'bad', name: 1 },
      ],
    });
    assert.equal(items.length, 1);
    assert.equal(roleLabel(presetId, items), 'Ops Lite');
    assert.equal(roleLabel('Manager', items), 'Manager');
  });

  it('uses role-presets upstream path', () => {
    const path = rolePresetsUpstreamPath(
      '11111111-1111-4111-8111-111111111111',
    );
    assert.match(path, /\/role-presets$/);
    assert.doesNotMatch(path, /permission-matrix/);
  });
});

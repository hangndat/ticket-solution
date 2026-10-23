import assert from 'node:assert/strict';
import test from 'node:test';
import { staffDeniedNotice } from '../src/nav/staff-denied-copy';

test('admin_denied includes portal CTA when PORTAL_ORIGIN set', () => {
  const notice = staffDeniedNotice('admin_denied', {
    PORTAL_ORIGIN: 'https://portal.vemoki.com',
  });
  assert.ok(notice);
  assert.match(notice.title, /quản trị/i);
  assert.equal(notice.portalAdminHref, 'https://portal.vemoki.com/');
});

test('admin_denied omits portal href without PORTAL_ORIGIN', () => {
  const notice = staffDeniedNotice('admin_denied', {});
  assert.ok(notice);
  assert.equal(notice.portalAdminHref, null);
});

test('gate_denied has no portal href', () => {
  const notice = staffDeniedNotice('gate_denied', {
    PORTAL_ORIGIN: 'https://portal.vemoki.com',
  });
  assert.ok(notice);
  assert.equal(notice.portalAdminHref, null);
  assert.match(notice.detail, /Vé của tôi/);
});

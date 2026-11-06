import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMembershipInviteWebUrl,
  extractMembershipInviteTokenFromUrl,
  isMembershipInviteToken,
  classifyMembershipInviteNavigation,
  parkMembershipInviteToken,
  peekMembershipInviteToken,
  clearMembershipInviteToken,
  membershipInviteGuidance,
} from './membership-invite-url.ts';

test('buildMembershipInviteWebUrl uses fragment token', () => {
  const token = 'b'.repeat(24);
  const url = buildMembershipInviteWebUrl(token);
  assert.match(url, /^https:\/\/app\.vemoki\.com\/invite#token=/);
  assert.ok(url.includes(encodeURIComponent(token)));
});

test('extractMembershipInviteTokenFromUrl reads hash and query', () => {
  const token = 'c'.repeat(24);
  const fromHash = new URL(`https://app.vemoki.com/invite#token=${token}`);
  assert.equal(extractMembershipInviteTokenFromUrl(fromHash), token);
  const fromQuery = new URL(`https://app.vemoki.com/invite?token=${token}`);
  assert.equal(extractMembershipInviteTokenFromUrl(fromQuery), token);
});

test('isMembershipInviteToken rejects short values', () => {
  assert.equal(isMembershipInviteToken('short'), false);
  assert.equal(isMembershipInviteToken('x'.repeat(16)), true);
});

test('no-token invite is a manual web entry with native guidance', () => {
  assert.equal(buildMembershipInviteWebUrl(''), 'https://app.vemoki.com/invite');
  assert.match(membershipInviteGuidance(false), /dán mã từ thư mời vào ô Mã lời mời trên trang web/);
  assert.match(membershipInviteGuidance(false), /đúng email đã được mời/);
  assert.doesNotMatch(membershipInviteGuidance(false), /SYNTHETICINVITETOKEN/);
  assert.doesNotMatch(membershipInviteGuidance(true), /dán mã/);
});

test('parked invite token stays out of the route and clears on exit', () => {
  const token = 'A'.repeat(32);
  const href = parkMembershipInviteToken(token);
  assert.match(href, /^\/membership-invite\?intent=\d+$/);
  assert.doesNotMatch(href, /A{8}/);
  assert.equal(peekMembershipInviteToken(), token);
  clearMembershipInviteToken();
  assert.equal(peekMembershipInviteToken(), '');
});

test('navigation allows exact product, OIDC realm, and portal origins only', () => {
  const config = {
    productOrigin: 'https://app.vemoki.com',
    oidcIssuer: 'https://auth.vemoki.com/realms/ticket',
    portalOrigin: 'https://portal.vemoki.com',
  };
  assert.equal(classifyMembershipInviteNavigation('https://app.vemoki.com/invite', config), 'web');
  assert.equal(classifyMembershipInviteNavigation('https://app.vemoki.com/api/auth/login?return=/invite', config), 'web');
  assert.equal(classifyMembershipInviteNavigation('https://auth.vemoki.com/realms/ticket/protocol/openid-connect/auth', config), 'web');
  assert.equal(classifyMembershipInviteNavigation('https://portal.vemoki.com/t/tenant', config), 'portal');
  for (const url of [
    'https://app.vemoki.com.evil.test/invite',
    'https://app.vemoki.com:444/invite',
    'https://auth.vemoki.com/realms/other/protocol/openid-connect/auth',
    'https://evil.test/#token=secret',
    'https://portal.vemoki.com/?token=secret',
    'https://auth.vemoki.com/realms/ticket/protocol/openid-connect/auth#token=secret',
    'javascript:alert(1)',
    'https://app.vemoki.com@evil.test/invite',
  ]) {
    assert.equal(classifyMembershipInviteNavigation(url, config), 'blocked');
  }
});

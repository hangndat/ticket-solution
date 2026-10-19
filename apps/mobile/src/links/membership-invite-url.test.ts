import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMembershipInviteWebUrl,
  extractMembershipInviteTokenFromUrl,
  isMembershipInviteToken,
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

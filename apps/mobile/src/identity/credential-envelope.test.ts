import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACCESS_TOKEN_REFRESH_SKEW_MS,
  accessTokenFromStored,
  accessTokenNeedsRefresh,
  encodeCredentialEnvelope,
  encodeStoredCredential,
  parseStoredCredential,
} from './credential-envelope.ts';

test('legacy plain bearer parses as access-only envelope', () => {
  const parsed = parseStoredCredential('plain-jwt');
  assert.equal(parsed.accessToken, 'plain-jwt');
  assert.equal(parsed.refreshToken, null);
  assert.equal(parsed.expiresAt, null);
  assert.equal(accessTokenFromStored('plain-jwt'), 'plain-jwt');
});

test('encodeStoredCredential keeps access-only as plain string', () => {
  assert.equal(encodeStoredCredential({ accessToken: 'tok' }), 'tok');
});

test('encodeStoredCredential with refreshToken writes JSON envelope', () => {
  const raw = encodeStoredCredential({
    accessToken: 'at',
    refreshToken: 'rt',
    expiresIn: 300,
  });
  const parsed = parseStoredCredential(raw);
  assert.equal(parsed.accessToken, 'at');
  assert.equal(parsed.refreshToken, 'rt');
  assert.ok(parsed.expiresAt != null);
  assert.ok(parsed.expiresAt! > Date.now());
  assert.equal(accessTokenFromStored(raw), 'at');
});

test('accessTokenNeedsRefresh respects skew window', () => {
  const now = 1_000_000;
  const envelope = {
    v: 1 as const,
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: now + ACCESS_TOKEN_REFRESH_SKEW_MS + 1,
  };
  assert.equal(accessTokenNeedsRefresh(envelope, now), false);
  assert.equal(
    accessTokenNeedsRefresh(
      { ...envelope, expiresAt: now + ACCESS_TOKEN_REFRESH_SKEW_MS },
      now,
    ),
    true,
  );
  assert.equal(
    accessTokenNeedsRefresh({ ...envelope, refreshToken: null }, now),
    false,
  );
});

test('envelope JSON round-trip via encodeCredentialEnvelope', () => {
  const raw = encodeCredentialEnvelope({
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 60,
  });
  assert.equal(JSON.parse(raw).v, 1);
  assert.equal(parseStoredCredential(raw).refreshToken, 'r');
});

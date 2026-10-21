import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import { isAccessTokenStaleForSsr } from '../src/oidc/access-token-clock';

const secret = new TextEncoder().encode('test-only');

test('isAccessTokenStaleForSsr: future exp is fresh', async () => {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
  assert.equal(isAccessTokenStaleForSsr(token), false);
});

test('isAccessTokenStaleForSsr: past exp is stale', async () => {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('-1h')
    .sign(secret);
  assert.equal(isAccessTokenStaleForSsr(token), true);
});

test('isAccessTokenStaleForSsr: garbage token is stale', () => {
  assert.equal(isAccessTokenStaleForSsr('not-a-jwt'), true);
});

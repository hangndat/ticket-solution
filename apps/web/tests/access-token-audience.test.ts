import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import { accessTokenIncludesAudience } from '../src/oidc/access-token-audience';

const secret = new TextEncoder().encode('test-only');

async function mintAud(aud: string | string[]) {
  return new SignJWT({ aud })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

test('accessTokenIncludesAudience accepts string aud', async () => {
  const token = await mintAud('ticket-api');
  assert.equal(accessTokenIncludesAudience(token, 'ticket-api'), true);
  assert.equal(accessTokenIncludesAudience(token, 'other'), false);
});

test('accessTokenIncludesAudience accepts aud array', async () => {
  const token = await mintAud(['ticket-web', 'ticket-api']);
  assert.equal(accessTokenIncludesAudience(token, 'ticket-api'), true);
});

test('accessTokenIncludesAudience rejects garbage jwt', () => {
  assert.equal(accessTokenIncludesAudience('not-jwt', 'ticket-api'), false);
});

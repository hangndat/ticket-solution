import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSessionRedirectOrigin } from '../src/oidc/public-origin';

const env = {
  NODE_ENV: 'test',
  WEB_PUBLIC_ORIGIN: 'http://localhost:3000',
} as NodeJS.ProcessEnv;

test('resolveSessionRedirectOrigin keeps 127.0.0.1 when allowlisted as localhost', () => {
  const origin = resolveSessionRedirectOrigin(
    { url: 'http://127.0.0.1:3000/api/auth/callback?code=x' },
    env,
  );
  assert.equal(origin, 'http://127.0.0.1:3000');
});

test('resolveSessionRedirectOrigin keeps localhost when configured', () => {
  const origin = resolveSessionRedirectOrigin(
    { url: 'http://localhost:3000/api/auth/callback?code=x' },
    env,
  );
  assert.equal(origin, 'http://localhost:3000');
});

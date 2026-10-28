import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './runtime.mjs';

const manifest = JSON.parse(readFileSync(process.env.E2E_MANIFEST, 'utf8'));
const account = manifest.accounts.attendee;
const issuer = `${manifest.origins.auth}/realms/e2e-${manifest.runId}`;
const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: manifest.runtime.httpClientId,
    client_secret: manifest.runtime.httpClientSecret,
    username: account.username,
    password: account.password,
    scope: 'openid profile email',
  }),
});
if (response.status !== 200)
  throw new Error(`BLOCKED: OIDC grant HTTP ${response.status}`);
const { access_token: token } = await response.json();
const requireBackend = createRequire(
  resolve(ROOT, 'packages/backend/package.json'),
);
const jose = requireBackend('jose');
try {
  await jose.jwtVerify(
    token,
    jose.createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`)),
    { issuer, audience: 'ticket-api', algorithms: ['RS256', 'ES256'] },
  );
  const backend = requireBackend('./dist/index.js');
  await backend
    .createOidcVerifier(backend.readOidcEnvironment(process.env))
    .verifyBearerToken(`Bearer ${token}`);
  console.log('OIDC real grant/signature/issuer/audience PASS');
} catch (error) {
  console.error(
    `BLOCKED: OIDC preflight ${error.code || error.name}: ${error.message}`,
  );
  process.exitCode = 2;
}

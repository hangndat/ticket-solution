const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const releaseDir = path.resolve(process.argv[2]);
const jose = require(path.join(releaseDir, 'packages/backend/node_modules/jose'));
const issuer = 'http://127.0.0.1:8080/realms/ticket';
const identities = new Map([
  ['apns-atleast-once-owner', 'owner-apns-652@example.com'],
  ['ar891-daemon-owner-2', 'daemon-owner-2@example.test'],
  ['ar891-daemon-owner-3', 'daemon-owner-3@example.test'],
]);

async function main() {
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  Object.assign(jwk, { kid: 'ar891-local-only', alg: 'RS256', use: 'sig' });
  http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture.local');
    if (url.pathname === '/jwks') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname === '/token') {
      const subject = url.searchParams.get('subject');
      const email = identities.get(subject);
      if (!email) {
        response.writeHead(404).end();
        return;
      }
      const token = await new jose.SignJWT({ email, email_verified: true })
        .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
        .setIssuer(issuer)
        .setAudience('ticket-api')
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ token }));
      return;
    }
    response.writeHead(404).end();
  }).listen(8080, '0.0.0.0');
  assert.ok(identities.size > 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

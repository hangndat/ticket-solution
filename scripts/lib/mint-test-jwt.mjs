/**
 * Mint a short-lived RS256 JWT + ephemeral JWKS HTTP for restore reconnect smoke.
 * Not for production. Token never logged.
 */
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function mintTestJwtAndJwks({
  subject,
  email,
  audience = 'ticket-api',
  issuer = 'http://127.0.0.1:18999/realms/ticket',
  port = 18999,
  ttlSec = 300,
}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = 'd5-restore-smoke';
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: jwk.kid };
  const payload = {
    iss: issuer,
    sub: subject,
    aud: audience,
    email,
    email_verified: true,
    iat: now,
    exp: now + ttlSec,
    jti: randomUUID(),
  };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  signer.end();
  const sig = b64url(signer.sign(privateKey));
  const token = `${h}.${p}.${sig}`;

  const server = createServer((req, res) => {
    if (req.url?.includes('/certs') || req.url?.includes('jwks')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (req.url?.includes('openid-configuration')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          issuer,
          jwks_uri: `http://127.0.0.1:${port}/certs`,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, '127.0.0.1');
  return {
    token,
    issuer,
    jwksUrl: `http://127.0.0.1:${port}/certs`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // CLI: print JSON {token,issuer,jwksUrl} — token to stdout only as JSON for scripts
  const subject = process.env.MINT_SUB || 'restore-smoke-sub';
  const email = process.env.MINT_EMAIL || 'owner-drill@example.com';
  const port = Number(process.env.MINT_PORT || 18999);
  const minted = mintTestJwtAndJwks({ subject, email, port });
  process.stdout.write(
    JSON.stringify({
      token: minted.token,
      issuer: minted.issuer,
      jwksUrl: minted.jwksUrl,
      subject,
      email,
    }),
  );
  // keep server alive until killed
  setInterval(() => {}, 1 << 30);
}

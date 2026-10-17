/**
 * Long-lived ephemeral JWKS + one RS256 access token for restore reconnect.
 * Usage:
 *   MINT_OUT=/tmp/mint.json MINT_PORT=18999 MINT_SUB=sub MINT_EMAIL=a@b.c \
 *     node scripts/lib/mint-test-jwt-server.mjs
 * Writes MINT_OUT then keeps listening until SIGTERM.
 */
import { writeFileSync } from 'node:fs';
import { mintTestJwtAndJwks } from './mint-test-jwt.mjs';

const port = Number(process.env.MINT_PORT || 18999);
const subject = process.env.MINT_SUB || 'restore-smoke-sub';
const email = process.env.MINT_EMAIL || 'owner-drill@example.com';
const out = process.env.MINT_OUT;
if (!out) {
  console.error('MINT_OUT required');
  process.exit(1);
}

const minted = mintTestJwtAndJwks({
  subject,
  email,
  port,
  issuer: `http://127.0.0.1:${port}/realms/ticket`,
});
writeFileSync(
  out,
  JSON.stringify({
    token: minted.token,
    issuer: minted.issuer,
    jwksUrl: minted.jwksUrl,
    subject,
    email,
  }),
);
process.stdout.write(`MINT_JWKS_READY port=${port}\n`);
process.on('SIGTERM', () => {
  minted.close().then(() => process.exit(0));
});
setInterval(() => {}, 1 << 30);

#!/usr/bin/env node
/**
 * Fixture Keycloak password grant for D9 UAT (local realm only).
 * Prints JSON: { issuer, staff: { sub }, attendee: { sub } }
 */
const issuer = (
  process.env.OIDC_ISSUER || 'http://127.0.0.1:8080/realms/ticket'
).replace(/\/$/, '');

async function discoverIssuer() {
  if (process.env.OIDC_ISSUER) return issuer;
  const bases = ['http://127.0.0.1:8080', 'http://127.0.0.1:18089'];
  for (const base of bases) {
    try {
      const res = await fetch(
        `${base}/realms/ticket/.well-known/openid-configuration`,
      );
      if (!res.ok) continue;
      const json = await res.json();
      if (json.issuer) return json.issuer.replace(/\/$/, '');
    } catch {
      /* next */
    }
  }
  throw new Error('Keycloak discovery failed — start compose Keycloak');
}

async function passwordToken(iss, username, password) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.OIDC_CLIENT_ID || 'ticket-web',
    client_secret:
      process.env.OIDC_CLIENT_SECRET || 'dev-web-secret-change-me',
    username,
    password,
  });
  const res = await fetch(`${iss}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `token ${username}: ${res.status} ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const payload = JSON.parse(
    Buffer.from(json.access_token.split('.')[1], 'base64url').toString('utf8'),
  );
  return { sub: payload.sub, email: payload.email };
}

async function main() {
  const iss = await discoverIssuer();
  const staff = await passwordToken(iss, 'staff@example.com', 'staff-demo');
  const attendee = await passwordToken(
    iss,
    'attendee@example.com',
    'attendee-demo',
  );
  console.log(
    JSON.stringify({ issuer: iss, staff, attendee }, null, 2),
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

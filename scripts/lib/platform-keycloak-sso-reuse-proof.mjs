/**
 * Live proof: an SSO session created via attendee `ticket-web` (password only) must NOT yield an
 * authorization code for `ticket-platform-web` / `ticket-admin-web` without OTP.
 * Local/dev Keycloak only (creates a throwaway user). Token never printed. Node stdlib only.
 */
import { createHash, randomBytes } from 'node:crypto';

const issuer = (process.env.D5_PLATFORM_OIDC_ISSUER || '').replace(/\/$/, '');
const kc = issuer.split('/realms/')[0];
const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const attendee = { clientId: 'ticket-web', redirectUri: 'http://127.0.0.1:3000/api/auth/callback' };
const mfaClients = [
  { clientId: 'ticket-platform-web', redirectUri: 'http://127.0.0.1:3000/api/auth/platform/callback' },
  { clientId: 'ticket-admin-web', redirectUri: 'http://127.0.0.1:3000/api/admin/auth/callback' },
];

const b64url = (b) => b.toString('base64url');
const jar = new Map();
const store = (res) => {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [nv] = c.split(';');
    const i = nv.indexOf('=');
    if (i > 0) jar.set(nv.slice(0, i), nv.slice(i + 1));
  }
};
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

function authUrl({ clientId, redirectUri }) {
  const verifier = b64url(randomBytes(32));
  return (
    `${issuer}/protocol/openid-connect/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid',
      state: b64url(randomBytes(8)),
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
    })
  );
}

async function main() {
  if (!issuer) throw new Error('D5_PLATFORM_OIDC_ISSUER required');
  const adminRes = await fetch(`${kc}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: adminUser, password: adminPass }),
  });
  if (!adminRes.ok) throw new Error(`admin token ${adminRes.status}`);
  const token = (await adminRes.json()).access_token;

  const username = `sso-proof-${Date.now()}@example.com`;
  const password = `SsoProof-${randomBytes(6).toString('hex')}!aA1`;
  const created = await fetch(`${kc}/admin/realms/ticket/users`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      username, email: username, firstName: 'Sso', lastName: 'Proof', enabled: true, emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  if (created.status >= 300) throw new Error(`create user ${created.status}`);

  // 1) attendee login (password only) establishes the Keycloak SSO session.
  let res = await fetch(authUrl(attendee), { redirect: 'manual' });
  store(res);
  const html = await res.text();
  const action = html.match(/id="kc-form-login"[^>]*action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!action) throw new Error('ticket-web login form missing');
  res = await fetch(action, {
    method: 'POST',
    redirect: 'manual',
    headers: { Cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  store(res);
  if (!(res.headers.get('location') || '').includes('code=')) throw new Error('ticket-web login did not issue a code');

  // 2) the same browser session must not get a code from MFA clients without OTP.
  for (const client of mfaClients) {
    res = await fetch(authUrl(client), { redirect: 'manual', headers: { Cookie: cookie() } });
    const loc = res.headers.get('location') || '';
    if (loc.includes('code=')) {
      throw new Error(`${client.clientId}: code issued from attendee SSO session without OTP`);
    }
  }
  console.log('PLATFORM_SSO_REUSE_PROOF_PASS clients=' + mfaClients.map((c) => c.clientId).join(','));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

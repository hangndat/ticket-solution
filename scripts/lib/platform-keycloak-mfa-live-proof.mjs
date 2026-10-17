/**
 * Live proof: Auth Code + PKCE + CONFIGURE_TOTP + OTP →
 * access token aud includes ticket-platform-api, acr=2, auth_time present.
 * Token never printed. Node stdlib only.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';

const issuer = (process.env.D5_PLATFORM_OIDC_ISSUER || '').replace(/\/$/, '');
const kc = issuer.split('/realms/')[0];
const realm = 'ticket';
const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const clientId = 'ticket-platform-web';
const clientSecret = 'dev-platform-web-secret-change-me';
const redirectUri = 'http://127.0.0.1:3010/api/platform/auth/callback';

/** Keycloak CONFIGURE_TOTP: HMAC key = UTF-8 bytes of totpSecret form field. */
function totpFromSessionSecret(sessionSecret, step = 30, digits = 6) {
  const key = Buffer.from(sessionSecret, 'utf8');
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeJwt(tok) {
  const p = tok.split('.')[1];
  const padded = p + '='.repeat((4 - (p.length % 4)) % 4);
  return JSON.parse(
    Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
  );
}

function extractForm(html) {
  const actionMatch = html.match(/<form[^>]*action="([^"]+)"/i);
  if (!actionMatch) return null;
  const action = actionMatch[1].replace(/&amp;/g, '&');
  const inputs = {};
  for (const tag of html.match(/<input[^>]*>/gi) || []) {
    const name = (tag.match(/name="([^"]+)"/i) || [])[1];
    if (!name) continue;
    inputs[name] = (tag.match(/value="([^"]*)"/i) || [])[1] || '';
  }
  return { action, inputs };
}

async function adminToken() {
  const res = await fetch(`${kc}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: adminUser,
      password: adminPass,
    }),
  });
  if (!res.ok) throw new Error(`admin token ${res.status}`);
  return (await res.json()).access_token;
}

async function api(token, method, path, data) {
  const res = await fetch(`${kc}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: res.status, raw: await res.text() };
}

async function main() {
  if (!issuer) throw new Error('D5_PLATFORM_OIDC_ISSUER required');
  const token = await adminToken();
  const username = `mfa-proof-${Date.now()}@example.com`;
  const password = `MfaProof-${randomBytes(6).toString('hex')}!aA1`;

  let r = await api(token, 'POST', `/admin/realms/${realm}/users`, {
    username,
    email: username,
    firstName: 'Mfa',
    lastName: 'Proof',
    enabled: true,
    emailVerified: true,
    requiredActions: ['CONFIGURE_TOTP'],
    credentials: [{ type: 'password', value: password, temporary: false }],
  });
  if (r.status !== 201 && r.status !== 204) {
    throw new Error(`create user ${r.status}: ${r.raw.slice(0, 200)}`);
  }

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const authUrl =
    `${issuer}/protocol/openid-connect/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

  const jar = new Map();
  const storeCookies = (res) => {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [nv] = c.split(';');
      const eq = nv.indexOf('=');
      if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1));
    }
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  const follow = async (startRes) => {
    let res = startRes;
    storeCookies(res);
    while (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      if (loc.includes('code=')) return { res, loc, html: '' };
      res = await fetch(new URL(loc, issuer).toString(), {
        redirect: 'manual',
        headers: { Cookie: cookieHeader() },
      });
      storeCookies(res);
    }
    const html = res.status === 200 ? await res.text() : '';
    return { res, loc: res.headers.get('location'), html };
  };

  let { res, html, loc } = await follow(
    await fetch(authUrl, { redirect: 'manual' }),
  );
  let form = extractForm(html);
  if (!form) throw new Error('login form missing');
  form.inputs.username = username;
  form.inputs.password = password;
  ({ res, html, loc } = await follow(
    await fetch(form.action, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(),
      },
      body: new URLSearchParams(form.inputs),
    }),
  ));

  if (!html || !/totpSecret/i.test(html)) {
    throw new Error('expected CONFIGURE_TOTP enrollment page after password');
  }
  form = extractForm(html);
  const sessionSecret = form?.inputs?.totpSecret;
  if (!sessionSecret) throw new Error('totpSecret missing on enroll form');
  const body = new URLSearchParams({
    totp: totpFromSessionSecret(sessionSecret),
    totpSecret: sessionSecret,
    userLabel: 'otp',
    'logout-sessions': 'on',
  });
  ({ res, html, loc } = await follow(
    await fetch(form.action, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(),
      },
      body,
    }),
  ));

  if (!loc || !loc.includes('code=')) {
    if (html && /name="otp"/i.test(html)) {
      form = extractForm(html);
      form.inputs.otp = totpFromSessionSecret(sessionSecret);
      ({ res, html, loc } = await follow(
        await fetch(form.action, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookieHeader(),
          },
          body: new URLSearchParams(form.inputs),
        }),
      ));
    }
  }

  if (!loc || !loc.includes('code=')) {
    const fb = (html.match(/kc-feedback-text[^>]*>\s*([^<]+)/) || [])[1] || '';
    throw new Error(`no auth code after MFA (status=${res.status}) ${fb}`.trim());
  }

  const code = new URL(loc).searchParams.get('code');
  if (!code) throw new Error('code missing');

  const tokRes = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  const tokJson = await tokRes.json();
  if (!tokRes.ok) {
    throw new Error(
      `token exchange ${tokRes.status}: ${JSON.stringify(tokJson).slice(0, 200)}`,
    );
  }
  const claims = decodeJwt(tokJson.access_token);
  const aud = claims.aud;
  const auds = Array.isArray(aud) ? aud : [aud];
  if (!auds.includes('ticket-platform-api')) {
    throw new Error(`aud missing ticket-platform-api: ${JSON.stringify(auds)}`);
  }
  if (String(claims.acr) !== '2') {
    throw new Error(`acr want 2 got ${claims.acr}`);
  }
  if (typeof claims.auth_time !== 'number') {
    throw new Error('auth_time missing');
  }
  process.stdout.write(
    `PLATFORM_MFA_LIVE_PROOF_PASS aud=${JSON.stringify(auds)} acr=${claims.acr} auth_time=${claims.auth_time} sub_len=${String(claims.sub || '').length}\n`,
  );

  try {
    const q = await api(
      token,
      'GET',
      `/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    );
    const users = JSON.parse(q.raw || '[]');
    if (users[0]?.id) {
      await api(token, 'DELETE', `/admin/realms/${realm}/users/${users[0].id}`);
    }
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});

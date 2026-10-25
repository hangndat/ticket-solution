import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import test from 'node:test';
import * as jose from 'jose';

const tenant = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  slug: 'demo',
  name: 'Demo',
  status: 'ACTIVE',
  role: 'Scanner',
  tenantPermissions: [],
};

async function freePort() {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('production callback and proxy gate staff while ticket owners remain attendees', async () => {
  const appPort = await freePort();
  const mockPort = await freePort();
  const portalPort = await freePort();
  const app = `http://localhost:${appPort}`;
  const mock = `http://127.0.0.1:${mockPort}`;
  const portal = `http://127.0.0.1:${portalPort}`;
  const issuer = `${mock}/realms/ticket`;
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = await jose.exportJWK(publicKey);
  Object.assign(jwk, { kid: 'staff-test', alg: 'RS256', use: 'sig' });
  const minted = new Map();
  let membershipCalls = 0;
  let tenantAdminCalls = 0;

  async function tokenFor(subject) {
    if (!minted.has(subject)) {
      minted.set(
        subject,
        await new jose.SignJWT({ azp: 'ticket-web' })
          .setProtectedHeader({ alg: 'RS256', kid: 'staff-test' })
          .setSubject(subject)
          .setIssuer(issuer)
          .setAudience('ticket-api')
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey),
      );
    }
    return minted.get(subject);
  }

  const upstream = createHttpServer(async (req, res) => {
    if (req.url?.startsWith('/v1/tenants/')) tenantAdminCalls++;
    if (req.url === '/jwks') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (req.url === '/realms/ticket/protocol/openid-connect/token') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const params = new URLSearchParams(Buffer.concat(chunks).toString());
      const subject =
        params.get('code') ??
        (params.get('refresh_token') === 'staff-refresh'
          ? 'staff'
          : 'attendee');
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          access_token:
            subject === 'bad-token'
              ? 'invalid.jwt.token'
              : await tokenFor(subject),
          refresh_token: 'test-refresh',
          expires_in: 300,
        }),
      );
      return;
    }
    if (req.url === '/v1/me/tenants') {
      membershipCalls++;
      let subject = '';
      try {
        subject =
          jose.decodeJwt(
            (req.headers.authorization ?? '').replace(/^Bearer /, ''),
          ).sub ?? '';
      } catch {
        /* invalid cookie */
      }
      res.setHeader('Content-Type', 'application/json');
      if (subject === 'api-error') {
        res.statusCode = 503;
        res.end('{}');
        return;
      }
      if (subject === 'unauthorized') {
        res.statusCode = 401;
        res.end('{}');
        return;
      }
      if (subject === 'bad-role') {
        res.end(JSON.stringify({ items: [{ ...tenant, role: 'Mystery' }] }));
        return;
      }
      const items =
        subject === 'staff'
          ? [tenant]
          : subject === 'mixed'
            ? [{ ...tenant, role: 'Attendee' }, tenant]
            : subject === 'ticket-owner'
              ? [{ ...tenant, role: 'Attendee' }]
              : [];
      res.end(JSON.stringify({ items }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  upstream.listen(mockPort, '127.0.0.1');
  await once(upstream, 'listening');

  const nextEnv = {
    ...process.env,
    WEB_PUBLIC_ORIGIN: app,
    PRODUCT_ORIGIN: app,
    PORTAL_ORIGIN: portal,
    API_BASE_URL: mock,
    OIDC_ISSUER: issuer,
    OIDC_CLIENT_ID: 'ticket-web',
    OIDC_CLIENT_SECRET: 'local-test-secret',
    OIDC_REDIRECT_URI: `${app}/api/auth/callback`,
    OIDC_AUDIENCE: 'ticket-api',
    OIDC_JWKS_URL: `${mock}/jwks`,
  };
  let child = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      'localhost',
      '--port',
      String(appPort),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], env: nextEnv },
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });

  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch(app)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await setTimeout(100);
    }
    assert.ok(ready, output);

    async function callback(code) {
      return fetch(`${app}/api/auth/callback?code=${code}&state=test-state`, {
        redirect: 'manual',
        headers: {
          Cookie: [
            'oidc_oauth_state=test-state',
            'oidc_pkce_verifier=test-verifier',
            'oidc_access_token=old-web-access',
            'oidc_refresh_token=old-web-refresh',
            'oidc_id_token=old-web-id',
            'web_oidc_sub=old-subject',
            'vemoki_post_login_path=%2Fwallet',
          ].join('; '),
        },
      });
    }
    function cookiesOf(response) {
      return response.headers.getSetCookie().join('\n');
    }
    for (const subject of ['staff', 'mixed']) {
      const response = await callback(subject);
      assert.equal(response.status, 307);
      assert.equal(
        response.headers.get('location'),
        `${portal}/api/auth/login`,
      );
      const cookies = cookiesOf(response);
      assert.match(cookies, /oidc_access_token=;/);
      assert.match(cookies, /oidc_refresh_token=;/);
      assert.match(cookies, /oidc_pkce_verifier=;/);
      assert.match(cookies, /vemoki_post_login_path=;/);
      assert.ok(!cookies.includes('access_token=eyJ'));
    }
    for (const subject of ['attendee', 'ticket-owner', 'revoked']) {
      const response = await callback(subject);
      assert.equal(response.headers.get('location'), `${app}/wallet`);
      assert.match(cookiesOf(response), /oidc_access_token=eyJ/);
    }
    for (const subject of ['api-error', 'unauthorized', 'bad-role']) {
      const response = await callback(subject);
      assert.equal(
        response.headers.get('location'),
        `${app}/auth?error=staff_check_unavailable`,
      );
      assert.match(cookiesOf(response), /oidc_access_token=;/);
      assert.ok(!cookiesOf(response).includes('access_token=eyJ'));
    }
    const invalidToken = await callback('bad-token');
    assert.match(
      invalidToken.headers.get('location'),
      /\/auth\?error=invalid_signature$/,
    );
    assert.ok(!cookiesOf(invalidToken).includes('access_token=eyJ'));

    const staffCookie = `oidc_access_token=${await tokenFor('staff')}; oidc_refresh_token=test-refresh`;
    const staffWallet = await fetch(`${app}/wallet`, {
      redirect: 'manual',
      headers: { Cookie: staffCookie },
    });
    assert.equal(
      staffWallet.headers.get('location'),
      `${portal}/api/auth/login`,
    );
    assert.match(cookiesOf(staffWallet), /oidc_access_token=;/);
    const staffMutation = await fetch(`${app}/wallet`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: staffCookie },
    });
    assert.equal(staffMutation.status, 403);
    assert.equal(staffMutation.headers.get('location'), null);
    const staffTicketApi = await fetch(`${app}/api/bff/tickets`, {
      redirect: 'manual',
      headers: { Cookie: staffCookie },
    });
    assert.equal(staffTicketApi.status, 403);
    assert.equal(staffTicketApi.headers.get('location'), null);
    const tenantId = tenant.tenantId;
    const legacyTenantPaths = [
      ['/api/bff/tenants/' + tenantId + '/invites', 'GET'],
      ['/api/bff/tenants/' + tenantId + '/invites', 'POST'],
      ['/api/bff/tenants/' + tenantId + '/members', 'GET'],
      ['/api/bff/tenants/' + tenantId + '/invites/' + tenantId + '/revoke', 'POST'],
      ['/api/bff/tenants/' + tenantId + '/members/' + tenantId + '/revoke', 'POST'],
    ];
    const beforeTenantAdmin = tenantAdminCalls;
    for (const [path, method] of legacyTenantPaths) {
      const response = await fetch(`${app}${path}`, {
        method,
        headers: {
          Cookie: staffCookie,
          Origin: app,
          'Content-Type': 'application/json',
        },
        body: method === 'POST' ? '{}' : undefined,
      });
      assert.equal(response.status, 410, `${method} ${path}`);
      assert.equal((await response.json()).code, 'LEGACY_GONE');
    }
    assert.equal(tenantAdminCalls, beforeTenantAdmin, 'legacy tenant routes must never reach upstream');
    const attendeeCookie = `oidc_access_token=${await tokenFor('ticket-owner')}`;
    for (const path of ['/api/bff/claim', '/api/bff/me/membership-invites/accept']) {
      const response = await fetch(`${app}${path}`, {
        method: 'POST',
        headers: { Cookie: attendeeCookie, 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, 403, `attendee ${path} must retain CSRF gate`);
      assert.equal((await response.json()).code, 'CSRF_ORIGIN_REQUIRED');
    }
    const staleStaff = await fetch(`${app}/wallet`, {
      redirect: 'manual',
      headers: { Cookie: 'oidc_refresh_token=staff-refresh' },
    });
    assert.match(
      new URL(staleStaff.headers.get('location'), app).pathname,
      /^\/api\/auth\/refresh$/,
    );
    const refreshedStaff = await fetch(
      new URL(staleStaff.headers.get('location'), app),
      {
        redirect: 'manual',
        headers: { Cookie: 'oidc_refresh_token=staff-refresh' },
      },
    );
    assert.equal(
      refreshedStaff.headers.get('location'),
      `${portal}/api/auth/login`,
    );
    assert.match(cookiesOf(refreshedStaff), /oidc_access_token=;/);

    const errorCookie = `oidc_access_token=${await tokenFor('api-error')}`;
    const errorWallet = await fetch(`${app}/wallet`, {
      redirect: 'manual',
      headers: { Cookie: errorCookie },
    });
    assert.equal(
      new URL(errorWallet.headers.get('location'), app).toString(),
      `${app}/?notice=staff_check_unavailable`,
    );
    assert.match(cookiesOf(errorWallet), /oidc_access_token=;/);
    const notice = await fetch(
      new URL(errorWallet.headers.get('location'), app),
    );
    assert.equal(notice.status, 200);
    assert.match(await notice.text(), /Chưa thể xác nhận tài khoản/);

    const attendeeWallet = await fetch(`${app}/wallet`, {
      headers: {
        Cookie: `oidc_access_token=${await tokenFor('ticket-owner')}`,
      },
    });
    assert.equal(attendeeWallet.status, 200);
    const beforeGuest = membershipCalls;
    const guestWallet = await fetch(`${app}/wallet`);
    assert.equal(guestWallet.status, 200);
    assert.equal(
      membershipCalls,
      beforeGuest,
      'guest navigation must not probe membership',
    );

    const beforePlatform = membershipCalls;
    const platformRoute = await fetch(`${app}/api/auth/platform/login`, {
      redirect: 'manual',
      headers: { Cookie: staffCookie },
    });
    assert.notEqual(
      platformRoute.headers.get('location'),
      `${portal}/api/auth/login`,
    );
    assert.equal(platformRoute.status, 410);
    assert.equal((await platformRoute.json()).code, 'LEGACY_GONE');
    assert.equal(membershipCalls, beforePlatform, 'platform auth is separate');

    // Misconfigured portal must never turn a known staff account into an attendee.
    child.kill('SIGTERM');
    await once(child, 'exit');
    child = spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'start',
        '--hostname',
        'localhost',
        '--port',
        String(appPort),
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...nextEnv, PORTAL_ORIGIN: app },
      },
    );
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    let restarted = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch(app)).ok) {
          restarted = true;
          break;
        }
      } catch {
        /* startup */
      }
      await setTimeout(100);
    }
    assert.ok(restarted, output);
    const noPortalCallback = await callback('staff');
    assert.equal(
      noPortalCallback.headers.get('location'),
      `${app}/auth?error=portal_unavailable`,
    );
    assert.match(cookiesOf(noPortalCallback), /oidc_access_token=;/);
    const noPortalWallet = await fetch(`${app}/wallet`, {
      redirect: 'manual',
      headers: { Cookie: staffCookie },
    });
    assert.equal(
      new URL(noPortalWallet.headers.get('location'), app).toString(),
      `${app}/?notice=portal_unavailable`,
    );
    assert.match(cookiesOf(noPortalWallet), /oidc_access_token=;/);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => {});
    }
    await new Promise((resolve) => upstream.close(resolve));
  }
});

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import test from 'node:test';

// Run against a production build, using an OS-assigned app-local test port.
test('production routes isolate tenant content and reject unknown pairs', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Production origin policy requires WEB_PUBLIC_ORIGIN (no Host/forwarded fallback).
        WEB_PUBLIC_ORIGIN: base,
        PORTAL_ORIGIN: 'http://127.0.0.1:3013',
        // Isolate from a live local API (:3001 default) during route fail-closed checks.
        API_BASE_URL: 'http://127.0.0.1:1',
      },
    },
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
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch(base)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await setTimeout(100);
    }
    assert.ok(ready, output);

    // ADR-19: public event pages fetch Nest. Without API → unreachable UI
    // (fail-closed). Never serve archived fixture catalog as published.
    for (const path of [
      '/t/mfest-demo/events/mfest',
      '/t/mfest/events/mfest-2026',
      '/t/demo-fun/events/fun-fest',
      '/t/sunburst/events/fun-fest-2026',
      '/t/unknown/events/unknown',
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.ok(
        html.includes('event-unreachable') ||
          html.includes('Không tải được sự kiện'),
        path,
      );
      assert.ok(!html.includes('Sunburst Collective'), path);
      assert.ok(!html.includes('MFest'), path);
      assert.ok(!html.includes('Northline Studio'), path);
      assert.ok(!html.includes('event-published'), path);
    }

    const home = await (await fetch(base)).text();
    assert.ok(
      home.includes('home-events-unreachable') ||
        home.includes('Không tải được danh sách') ||
        home.includes('home-events-empty') ||
        home.includes('Chưa có sự kiện đã xuất bản'),
    );
    assert.ok(!home.includes('/t/sunburst/events/fun-fest-2026'));
    assert.ok(!home.includes('/t/mfest/events/mfest-2026'));
    assert.ok(!home.includes('/t/northline/events/form-forum-2026'));
    assert.ok(!home.includes('Sunburst Collective'));
    assert.ok(!home.includes('MFest'));
    assert.ok(!home.includes('Northline Studio'));
    // O02 guest chrome: deny-by-default — no Admin/Cổng/Platform as if entitled.
    assert.ok(home.includes('data-testid="nav-redeem"') || home.includes('/redeem'));
    assert.ok(!home.includes('data-testid="nav-admin"'));
    assert.ok(!home.includes('data-testid="nav-gate"'));
    assert.ok(!home.includes('data-testid="nav-platform"'));
    assert.ok(!home.includes('data-testid="nav-wallet"'));

    const wallet = await fetch(base + '/wallet');
    assert.equal(wallet.status, 200);
    const walletHtml = await wallet.text();
    assert.ok(
      walletHtml.includes('data-testid="wallet-need-login"') ||
        walletHtml.includes('Cần đăng nhập'),
      'anonymous /wallet should prompt login',
    );
    assert.ok(!walletHtml.includes('data-testid="wallet-ready"'));

    // BFF list proxy exists; Nest down → 502 UPSTREAM_UNAVAILABLE.
    const listBff = await fetch(base + '/api/bff/public/tenants/mfest-demo/events');
    assert.equal(listBff.status, 502);
    assert.equal((await listBff.json()).code, 'UPSTREAM_UNAVAILABLE');
    // D13 / UX-UI revamp: anonymous owner-ticket shows login CTA on-page
    // (AC-S2 → /api/auth/login?return=…), not public event 404.
    const ticketPath =
      '/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6';
    const ticketFollow = await fetch(base + ticketPath);
    assert.equal(ticketFollow.status, 200);
    const ticketHtml = await ticketFollow.text();
    assert.ok(
      ticketHtml.includes('data-testid="owner-ticket-need-login"') ||
        ticketHtml.includes('Cần đăng nhập'),
      'owner ticket anonymous should show need-login surface',
    );
    assert.ok(
      ticketHtml.includes('/api/auth/login?return=') ||
        ticketHtml.includes('Đăng nhập'),
      'owner ticket anonymous should expose login CTA',
    );
    assert.ok(
      !ticketHtml.includes('data-testid="owner-ticket-missing"'),
      'anonymous deeplink must not render owner-ticket missing state',
    );
    assert.ok(
      !ticketHtml.includes('data-testid="owner-ticket-ready"'),
      'anonymous deeplink must not render owner-ticket ready state',
    );

    // D-7: GET /admin redirects to portal when PORTAL_ORIGIN is set (no legacy page).
    const adminRaw = await fetch(base + '/admin?tenantId=t1', { redirect: 'manual' });
    assert.equal(adminRaw.status, 302, 'GET /admin should redirect to portal');
    const adminLoc = adminRaw.headers.get('location') ?? '';
    assert.equal(adminLoc, 'http://127.0.0.1:3013/t/t1');
    // `/auth` is a thin redirect stub — no product login UI when OIDC unset.
    const authRaw = await fetch(base + '/auth', { redirect: 'manual' });
    assert.ok(
      authRaw.status === 307 || authRaw.status === 308,
      `expected /auth redirect, got ${authRaw.status}`,
    );
    const authLoc = authRaw.headers.get('location') ?? '';
    assert.ok(
      authLoc.includes('notice=auth_unavailable') || authLoc.includes('/api/auth/login'),
      `auth stub Location unexpected: ${authLoc}`,
    );
    const authFollow = await fetch(base + '/auth');
    assert.equal(authFollow.status, 200);
    const authHtml = await authFollow.text();
    assert.ok(authHtml.includes('Cần đăng nhập') || authHtml.includes('Đăng nhập'));
    assert.ok(
      authHtml.includes('không dùng phiên giả') ||
        authHtml.includes('data-testid="home-auth-notice"') ||
        authHtml.includes('data-testid="hero-wordmark"'),
    );
    assert.ok(!authHtml.includes('Clerk'));
    assert.ok(!authHtml.includes('Keycloak'));

    const redeem = await fetch(base + '/redeem');
    assert.equal(redeem.status, 200);
    const redeemHtml = await redeem.text();
    assert.ok(redeemHtml.includes('Đổi mã lấy vé'));
    assert.ok(redeemHtml.includes('Cần đăng nhập'));
    assert.ok(redeemHtml.includes('không thể đổi mã'));
    assert.ok(
      redeemHtml.includes('unconfigured') ||
        redeemHtml.includes('/api/auth/login?return='),
    );
    assert.ok(!redeemHtml.includes('Clerk'));
    assert.ok(!redeemHtml.includes('Keycloak'));

    // Guest claim chrome: plain VI, no OIDC/C-I jargon, not route error.tsx.
    const claim = await fetch(base + '/claim');
    assert.equal(claim.status, 200);
    const claimHtml = await claim.text();
    assert.ok(claimHtml.includes('Nhận lời mời sự kiện'));
    assert.ok(claimHtml.includes('Mở liên kết trong email'));
    assert.ok(claimHtml.includes('data-testid="claim-token-empty"'));
    assert.ok(!claimHtml.includes('OIDC'));
    assert.ok(!claimHtml.includes('C-I'));
    assert.ok(!claimHtml.includes('C-F'));
    assert.ok(!claimHtml.includes('Guest claim'));
    assert.ok(!claimHtml.includes('Keycloak'));
    assert.ok(!claimHtml.includes('Không tải được trang này'));

    // Launch UAT A04: anonymous /gate → auth soft-redirect (307 /auth?next=/gate).
    const gateRaw = await fetch(base + '/gate', { redirect: 'manual' });
    assert.ok(
      gateRaw.status === 307 || gateRaw.status === 302,
      `GET /gate should HTTP 307/302, got ${gateRaw.status}`,
    );
    const gateLoc = gateRaw.headers.get('location') ?? '';
    assert.match(gateLoc, /\/auth(\?|$)/, `Location should be /auth: ${gateLoc}`);
    assert.match(gateLoc, /next=%2Fgate|next=\/gate/, `Location should preserve next=/gate: ${gateLoc}`);

    // Issue #1021: bogus Server Action probes → 400 at proxy (no use server in web).
    for (const actionId of ['x', 'action', '0', '1']) {
      const probe = await fetch(base + '/redeem', {
        method: 'POST',
        headers: { 'next-action': actionId },
        body: '',
      });
      assert.equal(probe.status, 400, `next-action=${actionId}`);
    }

    // Redeem BFF: CSRF/Origin fail-closed before OIDC.
    const redeemCsrfBlocked = await fetch(base + '/api/bff/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        code: 'DEMO',
      }),
    });
    assert.equal(redeemCsrfBlocked.status, 403);
    assert.equal((await redeemCsrfBlocked.json()).code, 'CSRF_ORIGIN_REQUIRED');

    // Invite accept BFF: Origin missing must fail-closed before OIDC/upstream.
    const inviteCsrfBlocked = await fetch(
      base + '/api/bff/me/membership-invites/accept',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'fixture-not-logged',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        }),
      },
    );
    assert.equal(inviteCsrfBlocked.status, 403);
    assert.equal(
      (await inviteCsrfBlocked.json()).code,
      'CSRF_ORIGIN_REQUIRED',
    );

    const inviteEvilOrigin = await fetch(
      base + '/api/bff/me/membership-invites/accept',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({
          token: 'fixture-not-logged',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        }),
      },
    );
    assert.equal(inviteEvilOrigin.status, 403);
    assert.equal(
      (await inviteEvilOrigin.json()).code,
      'CSRF_ORIGIN_MISMATCH',
    );

    const csrfToken = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const redeemBff = await fetch(base + '/api/bff/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
        'x-csrf-token': csrfToken,
        Cookie: `vemoki_csrf=${csrfToken}`,
      },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        code: 'DEMO',
      }),
    });
    assert.equal(redeemBff.status, 503);
    const redeemErr = await redeemBff.json();
    assert.equal(redeemErr.code, 'OIDC_MISCONFIGURED');

    // D-7: legacy staff BFF on apps/web → 410 Gone (proxy).
    const legacyGone = await fetch(base + '/api/bff/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        expectedVersion: 1,
      }),
    });
    assert.equal(legacyGone.status, 410);
    assert.equal((await legacyGone.json()).code, 'LEGACY_GONE');
    const legacyGet = await fetch(base + '/api/bff/admin/events');
    assert.equal(legacyGet.status, 410);
  } finally {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
});

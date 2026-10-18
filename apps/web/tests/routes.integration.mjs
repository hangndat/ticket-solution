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
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  const base = `http://127.0.0.1:${port}`;
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

    // Owner ticket email deep-link: route must exist (not Next 404).
    // Guest → HTTP 200 + login CTA (documented); no credential in URL.
    const ticketId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const ticketPath = `/t/uat-device/tickets/${ticketId}`;
    const ticketRes = await fetch(base + ticketPath);
    assert.equal(ticketRes.status, 200, ticketPath);
    const ticketHtml = await ticketRes.text();
    assert.ok(ticketHtml.includes('owner-ticket-page'), ticketPath);
    assert.ok(ticketHtml.includes('owner-ticket-auth-required'), ticketPath);
    assert.ok(ticketHtml.includes('Cần đăng nhập'), ticketPath);
    assert.ok(ticketHtml.includes('/auth?next='), ticketPath);
    assert.ok(!ticketHtml.includes('Không tải được trang này'), ticketPath);
    const badTicket = await fetch(base + '/t/uat-device/tickets/not-a-uuid');
    assert.equal(badTicket.status, 200);
    const badHtml = await badTicket.text();
    assert.ok(badHtml.includes('owner-ticket-invalid-params'));
    assert.ok(badHtml.includes('Liên kết vé không hợp lệ'));

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

    // BFF list proxy exists; Nest down → 502 UPSTREAM_UNAVAILABLE.
    const listBff = await fetch(base + '/api/bff/public/tenants/mfest-demo/events');
    assert.equal(listBff.status, 502);
    assert.equal((await listBff.json()).code, 'UPSTREAM_UNAVAILABLE');
    // O02: anonymous /admin soft-redirects (proxy 307) to /auth?next=/admin.
    const adminRaw = await fetch(base + '/admin', { redirect: 'manual' });
    assert.equal(adminRaw.status, 307, 'anonymous /admin should HTTP 307');
    const adminLoc = adminRaw.headers.get('location') ?? '';
    assert.ok(adminLoc.includes('/auth'), `Location ${adminLoc}`);
    assert.ok(
      adminLoc.includes('next=') && adminLoc.includes('admin'),
      `next=/admin missing in ${adminLoc}`,
    );
    const adminFollow = await fetch(base + '/admin');
    assert.equal(adminFollow.status, 200);
    const adminHtml = await adminFollow.text();
    assert.ok(adminHtml.includes('Đăng nhập') || adminHtml.includes('Cần đăng nhập'));
    assert.ok(!adminHtml.includes('Không gian quản trị sự kiện'));
    assert.ok(!adminHtml.includes('admin-tech-details'));
    assert.ok(!adminHtml.includes('data-testid="nav-admin"'));
    assert.ok(!adminHtml.includes('data-testid="nav-gate"'));
    assert.ok(!adminHtml.includes('data-testid="nav-platform"'));
    const authPoc = await fetch(base + '/auth');
    assert.equal(authPoc.status, 200);
    const authHtml = await authPoc.text();
    assert.ok(authHtml.includes('Cần đăng nhập'));
    assert.ok(authHtml.includes('unconfigured'));
    assert.ok(authHtml.includes('không coi là đã'));
    assert.ok(authHtml.includes('không dùng phiên giả'));
    assert.ok(!authHtml.includes('Clerk'));
    assert.ok(!authHtml.includes('Keycloak'));

    const redeem = await fetch(base + '/redeem');
    assert.equal(redeem.status, 200);
    const redeemHtml = await redeem.text();
    assert.ok(redeemHtml.includes('Đổi mã lấy vé'));
    assert.ok(redeemHtml.includes('Cần đăng nhập'));
    assert.ok(redeemHtml.includes('không thể đổi mã'));
    assert.ok(redeemHtml.includes('unconfigured'));
    assert.ok(!redeemHtml.includes('Clerk'));
    assert.ok(!redeemHtml.includes('Keycloak'));

    // Guest claim chrome: plain VI, no OIDC/C-I jargon, not route error.tsx.
    const claim = await fetch(base + '/claim');
    assert.equal(claim.status, 200);
    const claimHtml = await claim.text();
    assert.ok(claimHtml.includes('Nhận lời mời sự kiện'));
    assert.ok(claimHtml.includes('Chưa có mã lời mời'));
    assert.ok(claimHtml.includes('Đăng nhập rồi quay lại nhận lời mời'));
    assert.ok(!claimHtml.includes('OIDC'));
    assert.ok(!claimHtml.includes('C-I'));
    assert.ok(!claimHtml.includes('C-F'));
    assert.ok(!claimHtml.includes('Guest claim'));
    assert.ok(!claimHtml.includes('Keycloak'));
    assert.ok(!claimHtml.includes('Không tải được trang này'));

    // O02: anonymous /gate soft-redirects (proxy 307) to /auth?next=/gate.
    const gateRaw = await fetch(base + '/gate', { redirect: 'manual' });
    assert.equal(gateRaw.status, 307, 'anonymous /gate should HTTP 307');
    const gateLoc = gateRaw.headers.get('location') ?? '';
    assert.ok(gateLoc.includes('/auth'), `Location ${gateLoc}`);
    assert.ok(
      gateLoc.includes('next=') && gateLoc.includes('gate'),
      `next=/gate missing in ${gateLoc}`,
    );
    const gateFollow = await fetch(base + '/gate');
    assert.equal(gateFollow.status, 200);
    const gateHtml = await gateFollow.text();
    assert.ok(gateHtml.includes('Đăng nhập') || gateHtml.includes('Cần đăng nhập'));
    assert.ok(!gateHtml.includes('data-testid="gate-offline-shell"'));
    assert.ok(!gateHtml.includes('gate-confirm-submit'));

    // Gate BFF: Origin missing must fail-closed before OIDC/upstream (admin pattern).
    const gateCsrfBlocked = await fetch(base + '/api/bff/gate/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        reservationId: '33333333-3333-4333-8333-333333333333',
        staffSessionId: '44444444-4444-4444-8444-444444444444',
        token: 'hold-token',
      }),
    });
    assert.equal(gateCsrfBlocked.status, 403);
    assert.equal((await gateCsrfBlocked.json()).code, 'CSRF_ORIGIN_REQUIRED');

    const gateBff = await fetch(base + '/api/bff/gate/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
      },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        reservationId: '33333333-3333-4333-8333-333333333333',
        staffSessionId: '44444444-4444-4444-8444-444444444444',
        token: 'hold-token',
      }),
    });
    assert.equal(gateBff.status, 503);
    assert.equal((await gateBff.json()).code, 'OIDC_MISCONFIGURED');

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

    // CSRF: mutating admin BFF without Origin must fail closed before OIDC.
    const csrfBlocked = await fetch(base + '/api/bff/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        expectedVersion: 1,
      }),
    });
    assert.equal(csrfBlocked.status, 403);
    assert.equal((await csrfBlocked.json()).code, 'CSRF_ORIGIN_REQUIRED');

    const sameOriginJson = {
      'Content-Type': 'application/json',
      Origin: base,
    };

    const publishBff = await fetch(base + '/api/bff/admin/publish', {
      method: 'POST',
      headers: sameOriginJson,
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        expectedVersion: 1,
      }),
    });
    assert.equal(publishBff.status, 503);
    assert.equal((await publishBff.json()).code, 'OIDC_MISCONFIGURED');
    const importBff = await fetch(base + '/api/bff/admin/imports', {
      method: 'POST',
      headers: sameOriginJson,
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        codes: ['CODE-A'],
        eventQuota: 10,
      }),
    });
    assert.equal(importBff.status, 503);
    assert.equal((await importBff.json()).code, 'OIDC_MISCONFIGURED');
    const quotaBff = await fetch(
      base +
        '/api/bff/admin/quota?tenantId=11111111-1111-4111-8111-111111111111&eventId=22222222-2222-4222-8222-222222222222',
    );
    assert.equal(quotaBff.status, 503);
    assert.equal((await quotaBff.json()).code, 'OIDC_MISCONFIGURED');
    const reportBff = await fetch(
      base +
        '/api/bff/admin/report?tenantId=11111111-1111-4111-8111-111111111111&eventId=22222222-2222-4222-8222-222222222222',
    );
    assert.equal(reportBff.status, 503);
    assert.equal((await reportBff.json()).code, 'OIDC_MISCONFIGURED');

    const approvalBody = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
      requestId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    };
    const approveBff = await fetch(base + '/api/bff/admin/redemptions/approve', {
      method: 'POST',
      headers: sameOriginJson,
      body: JSON.stringify(approvalBody),
    });
    assert.equal(approveBff.status, 503);
    assert.equal((await approveBff.json()).code, 'OIDC_MISCONFIGURED');
    const denyBff = await fetch(base + '/api/bff/admin/redemptions/deny', {
      method: 'POST',
      headers: sameOriginJson,
      body: JSON.stringify({ ...approvalBody, reason: 'Không đủ điều kiện' }),
    });
    assert.equal(denyBff.status, 503);
    assert.equal((await denyBff.json()).code, 'OIDC_MISCONFIGURED');

    // C-E create uses full CSRF double-submit (not Origin-only); missing token → 403.
    const createEventBff = await fetch(base + '/api/bff/admin/events', {
      method: 'POST',
      headers: sameOriginJson,
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        slug: 'aurora-night',
        name: 'Aurora Night',
        idempotencyKey: '66666666-6666-4666-8666-666666666666',
      }),
    });
    assert.equal(createEventBff.status, 403);
    assert.equal((await createEventBff.json()).code, 'CSRF_TOKEN_INVALID');

    const csListBff = await fetch(
      base +
        '/api/bff/admin/tickets?tenantId=11111111-1111-4111-8111-111111111111&eventId=22222222-2222-4222-8222-222222222222&q=test',
    );
    assert.equal(csListBff.status, 503);
    assert.equal((await csListBff.json()).code, 'OIDC_MISCONFIGURED');

    const csResendBff = await fetch(
      base +
        '/api/bff/admin/tickets/33333333-3333-4333-8333-333333333333/resend',
      {
        method: 'POST',
        headers: sameOriginJson,
        body: JSON.stringify({
          tenantId: '11111111-1111-4111-8111-111111111111',
          eventId: '22222222-2222-4222-8222-222222222222',
          idempotencyKey: '44444444-4444-4444-8444-444444444444',
        }),
      },
    );
    assert.equal(csResendBff.status, 503);
    assert.equal((await csResendBff.json()).code, 'OIDC_MISCONFIGURED');

    const exportBff = await fetch(base + '/api/bff/admin/exports', {
      method: 'POST',
      headers: sameOriginJson,
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        format: 'csv',
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
      }),
    });
    assert.equal(exportBff.status, 503);
    assert.equal((await exportBff.json()).code, 'OIDC_MISCONFIGURED');
  } finally {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
});

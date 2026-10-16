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
    for (const [path, own, foreign] of [
      [
        '/t/sunburst/events/fun-fest-2026',
        'Sunburst Collective',
        'Northline Studio',
      ],
      [
        '/t/northline/events/form-forum-2026',
        'Northline Studio',
        'Sunburst Collective',
      ],
      [
        '/t/sunburst/events/fun-fest-2026',
        'Sunburst Collective',
        'Northline Studio',
      ],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(own));
      assert.ok(!html.includes(foreign));
      assert.ok(html.includes('FICTIONAL EVENT / DEMO FIXTURE'));
    }
    for (const path of [
      '/t/sunburst/events/form-forum-2026',
      '/t/northline/events/fun-fest-2026',
      '/t/unknown/events/fun-fest-2026',
      '/t/sunburst/events/unknown',
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404, path);
      const html = await response.text();
      assert.ok(!html.includes('Sunburst Collective'));
      assert.ok(!html.includes('Northline Studio'));
    }
    const home = await (await fetch(base)).text();
    assert.ok(home.includes('/t/sunburst/events/fun-fest-2026'));
    assert.ok(home.includes('/t/northline/events/form-forum-2026'));
    const admin = await fetch(base + '/admin');
    assert.equal(admin.status, 200);
    const adminHtml = await admin.text();
    assert.ok(adminHtml.includes('Cấu hình sự kiện'));
    assert.ok(adminHtml.includes('OIDC chưa cấu hình'));
    assert.ok(adminHtml.includes('Không coi là đã lưu'));
    assert.ok(adminHtml.includes('Xem trước'));
    assert.ok(adminHtml.includes('Lưu phiên bản'));
    assert.ok(adminHtml.includes('Nhập mã'));
    assert.ok(adminHtml.includes('Đọc quota'));
    assert.ok(adminHtml.includes('Báo cáo sự kiện'));
    assert.ok(adminHtml.includes('Tải báo cáo'));
    assert.ok(adminHtml.includes('Duyệt'));
    assert.ok(adminHtml.includes('Từ chối'));
    assert.ok(adminHtml.includes('Lý do từ chối'));
    assert.equal(/FUN FEST|fun-fest/i.test(adminHtml), false);
    const authPoc = await fetch(base + '/auth');
    assert.equal(authPoc.status, 200);
    const authHtml = await authPoc.text();
    assert.ok(authHtml.includes('OIDC chưa cấu hình'));
    assert.ok(authHtml.includes('unconfigured'));
    assert.ok(authHtml.includes('không coi là đã'));
    assert.ok(!authHtml.includes('Clerk'));
    assert.ok(authHtml.includes('Keycloak'));

    const redeem = await fetch(base + '/redeem');
    assert.equal(redeem.status, 200);
    const redeemHtml = await redeem.text();
    assert.ok(redeemHtml.includes('Đổi mã lấy vé'));
    assert.ok(redeemHtml.includes('OIDC chưa cấu hình'));
    assert.ok(redeemHtml.includes('không mock'));
    assert.ok(!redeemHtml.includes('Clerk'));

    const gate = await fetch(base + '/gate');
    assert.equal(gate.status, 200);
    const gateHtml = await gate.text();
    assert.ok(gateHtml.includes('Cổng check-in'));
    assert.ok(gateHtml.includes('Không cho khách qua'));
    assert.ok(gateHtml.includes('OIDC chưa cấu hình'));

    const gateBff = await fetch(base + '/api/bff/gate/confirm', {
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
    assert.equal(gateBff.status, 503);
    assert.equal((await gateBff.json()).code, 'OIDC_MISCONFIGURED');

    const redeemBff = await fetch(base + '/api/bff/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        code: 'DEMO',
      }),
    });
    assert.equal(redeemBff.status, 503);
    const redeemErr = await redeemBff.json();
    assert.equal(redeemErr.code, 'OIDC_MISCONFIGURED');

    const publishBff = await fetch(base + '/api/bff/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvalBody),
    });
    assert.equal(approveBff.status, 503);
    assert.equal((await approveBff.json()).code, 'OIDC_MISCONFIGURED');
    const denyBff = await fetch(base + '/api/bff/admin/redemptions/deny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...approvalBody, reason: 'Không đủ điều kiện' }),
    });
    assert.equal(denyBff.status, 503);
    assert.equal((await denyBff.json()).code, 'OIDC_MISCONFIGURED');
  } finally {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
});

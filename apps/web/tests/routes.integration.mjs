import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import test from 'node:test';

/**
 * Mock Nest published projection for production route isolation (ADR-19).
 * Guest pages load server SoT via API_BASE_URL — never client fixtures.
 */
function publishedSummary(event) {
  const {
    sections: _sections,
    faq: _faq,
    terms: _terms,
    ...summary
  } = event;
  return summary;
}

const PUBLISHED_EVENTS = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    tenantSlug: 'demo-fun',
    slug: 'fun-fest-2026',
    name: 'FUN FEST 2026 · Demo',
    timezone: 'Asia/Ho_Chi_Minh',
    startsAt: '2026-12-12T09:00:00+07:00',
    location: 'Riverside Park · Ho Chi Minh City',
    publishedConfigVersion: 1,
    schemaVersion: 1,
    brand: {
      primaryColor: '#783013',
      organizationName: 'Sunburst Collective · Demo',
    },
    sections: [
      {
        id: 'sec-hero',
        kind: 'hero',
        visible: true,
        order: 0,
        title: 'Music / Community',
        bodyMarkdown: 'A little louder.',
      },
    ],
    faq: [],
    terms: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    tenantSlug: 'demo-studio',
    slug: 'form-forum-2026',
    name: 'Form & Forum · Demo',
    timezone: 'Asia/Singapore',
    startsAt: '2026-12-18T10:00:00+08:00',
    location: 'The Assembly Studio · Singapore',
    publishedConfigVersion: 1,
    schemaVersion: 1,
    brand: {
      primaryColor: '#154c42',
      organizationName: 'Northline Studio · Demo',
    },
    sections: [
      {
        id: 'sec-hero',
        kind: 'hero',
        visible: true,
        order: 0,
        title: 'Design / Ideas',
        bodyMarkdown: 'Make space for a different perspective.',
      },
    ],
    faq: [],
    terms: null,
  },
];

async function listenPublishedMock() {
  const byTenant = new Map();
  for (const event of PUBLISHED_EVENTS) {
    const list = byTenant.get(event.tenantSlug) ?? [];
    list.push(event);
    byTenant.set(event.tenantSlug, list);
  }

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const match = url.pathname.match(
      /^\/v1\/public\/tenants\/([^/]+)\/events(?:\/([^/]+))?\/?$/,
    );
    if (!match || req.method !== 'GET') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'NOT_FOUND' }));
      return;
    }
    const tenantSlug = decodeURIComponent(match[1]);
    const eventSlug = match[2] ? decodeURIComponent(match[2]) : null;
    const events = byTenant.get(tenantSlug) ?? [];

    if (!eventSlug) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          items: events.map(publishedSummary),
          nextCursor: null,
        }),
      );
      return;
    }

    const found = events.find((e) => e.slug === eventSlug);
    if (!found) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'NOT_FOUND' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// Run against a production build, using an OS-assigned app-local test port.
test('production routes isolate tenant content and reject unknown pairs', async () => {
  const mock = await listenPublishedMock();
  const reservation = createNetServer();
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
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        API_BASE_URL: mock.baseUrl,
        PUBLIC_HOME_TENANT_SLUGS: 'demo-fun,demo-studio',
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
        '/t/demo-fun/events/fun-fest-2026',
        'Sunburst Collective · Demo',
        'Northline Studio · Demo',
      ],
      [
        '/t/demo-studio/events/form-forum-2026',
        'Northline Studio · Demo',
        'Sunburst Collective · Demo',
      ],
      [
        '/t/demo-fun/events/fun-fest-2026',
        'Sunburst Collective · Demo',
        'Northline Studio · Demo',
      ],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(own), `missing own brand on ${path}`);
      assert.ok(!html.includes(foreign), `leaked foreign brand on ${path}`);
      assert.ok(html.includes('Sự kiện demo · Không dùng vào cổng'));
      assert.ok(html.includes('data-testid="event-published"'));
    }
    // Unknown tenant/event pairs: published SoT returns not-found UI (no brand leak).
    // Matched dynamic segments may soft-404 (HTTP 200 + not-found.js) under Next 16;
    // unmatched paths stay hard 404. Isolation matter is content, not status code alone.
    for (const path of [
      '/t/demo-fun/events/form-forum-2026',
      '/t/demo-studio/events/fun-fest-2026',
      '/t/unknown/events/fun-fest-2026',
      '/t/demo-fun/events/unknown',
    ]) {
      const response = await fetch(base + path);
      assert.ok(
        response.status === 404 || response.status === 200,
        `${path} unexpected status ${response.status}`,
      );
      const html = await response.text();
      assert.ok(
        html.includes('Chưa có gì ở đây') ||
          html.includes('Không tìm thấy tổ hợp tenant và sự kiện này'),
        `missing not-found copy on ${path}`,
      );
      assert.ok(!html.includes('data-testid="event-published"'), path);
      assert.ok(!html.includes('Sunburst Collective · Demo'), path);
      assert.ok(!html.includes('Northline Studio · Demo'), path);
    }
    const home = await (await fetch(base)).text();
    assert.ok(home.includes('/t/demo-fun/events/fun-fest-2026'));
    assert.ok(home.includes('/t/demo-studio/events/form-forum-2026'));
    assert.ok(home.includes('Sunburst Collective · Demo'));
    assert.ok(home.includes('Northline Studio · Demo'));
    assert.ok(home.includes('Danh sách từ máy chủ'));
    const admin = await fetch(base + '/admin');
    assert.equal(admin.status, 200);
    const adminHtml = await admin.text();
    assert.ok(adminHtml.includes('Không gian quản trị sự kiện'));
    assert.ok(adminHtml.includes('OIDC chưa cấu hình'));
    assert.ok(adminHtml.includes('không coi là thành công'));
    assert.ok(adminHtml.includes('Xem trước'));
    assert.ok(adminHtml.includes('Lưu phiên bản'));
    assert.ok(adminHtml.includes('Nhập mã'));
    assert.ok(adminHtml.includes('Đọc quota'));
    assert.ok(adminHtml.includes('Cổng · báo cáo sự kiện'));
    assert.ok(adminHtml.includes('Tải lại báo cáo'));
    assert.ok(adminHtml.includes('Duyệt'));
    assert.ok(adminHtml.includes('Từ chối'));
    assert.ok(adminHtml.includes('Lý do từ chối'));
    assert.ok(adminHtml.includes('Tạo event'));
    assert.ok(adminHtml.includes('Tìm vé CS'));
    assert.ok(adminHtml.includes('Gửi lại email'));
    assert.ok(adminHtml.includes('Tạo export CSV'));
    assert.ok(adminHtml.includes('Tải CSV'));
    assert.ok(adminHtml.includes('Hỗ trợ · tra cứu và gửi lại email'));
    assert.ok(adminHtml.includes('Chuẩn bị'));
    assert.ok(adminHtml.includes('Xuất bản'));
    assert.ok(adminHtml.includes('admin-tech-details'));
    assert.ok(!adminHtml.includes('ticket↗'));
    assert.ok(adminHtml.includes('vemoki'));
    assert.equal(/FUN FEST|fun-fest/i.test(adminHtml), false);
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
    await new Promise((resolve) => mock.server.close(resolve));
  }
});

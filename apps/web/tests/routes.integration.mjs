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
    assert.ok(
      (await admin.text()).includes('Not authenticated. Not implemented.'),
    );
    const authPoc = await fetch(base + '/auth');
    assert.equal(authPoc.status, 200);
    const authHtml = await authPoc.text();
    assert.ok(authHtml.includes('OIDC chưa cấu hình'));
    assert.ok(authHtml.includes('unconfigured'));
    assert.ok(authHtml.includes('không coi là đã'));
    assert.ok(!authHtml.includes('Clerk'));
    assert.ok(authHtml.includes('Keycloak'));
  } finally {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
});

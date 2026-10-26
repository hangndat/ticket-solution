import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { PORTAL_FORBIDDEN_EVENT, portalGet } from '../src/client/portal-fetch';

test('a BFF 403 signals the shell to replace stale tenant content with forbidden', async () => {
  const previousWindow = (globalThis as { window?: Window }).window;
  const target = new EventTarget();
  (globalThis as { window?: Window }).window = target as Window;
  const paths: string[] = [];
  target.addEventListener(PORTAL_FORBIDDEN_EVENT, (event) => {
    paths.push((event as CustomEvent<string>).detail);
  });
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 }),
  );
  try {
    const result = await portalGet('/api/bff/tenants/t1/events/e1/report');
    assert.equal(result.status, 403);
    assert.deepEqual(paths, ['/api/bff/tenants/t1/events/e1/report']);
  } finally {
    fetchMock.mock.restore();
    if (previousWindow === undefined) {
      delete (globalThis as { window?: Window }).window;
    } else {
      (globalThis as { window?: Window }).window = previousWindow;
    }
  }
});

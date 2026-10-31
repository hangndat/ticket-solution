import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  PORTAL_FORBIDDEN_EVENT,
  forbiddenScopeAffectsPath,
  forbiddenScopeFromBffPath,
  portalGet,
  portalMutate,
} from '../src/client/portal-fetch';
import { resetActorGateForTests } from '../src/client/actor-gate';

const bindingHeaders = {
  'X-Portal-Actor-Id': 'staff-a',
  'X-Portal-Auth-Epoch': 'epoch-a',
  'X-Portal-Surface': 'staff',
};

function installActorDocument(): () => void {
  const previous = (globalThis as { document?: Document }).document;
  (globalThis as { document?: Document }).document = { cookie: 'portal_staff_epoch=epoch-a' } as Document;
  resetActorGateForTests();
  return () => {
    resetActorGateForTests();
    if (previous === undefined) delete (globalThis as { document?: Document }).document;
    else (globalThis as { document?: Document }).document = previous;
  };
}

function responseForActor(path: string, response: Response): Response {
  if (path.startsWith('/api/auth/identity')) {
    return Response.json({ actorId: 'staff-a', authEpoch: 'epoch-a', surface: 'staff' });
  }
  return response;
}

test('a BFF 403 signals the shell to replace stale tenant content with forbidden', async () => {
  const restoreDocument = installActorDocument();
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
    async (input: string) => responseForActor(input,
      new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403, headers: bindingHeaders })),
  );
  try {
    const result = await portalGet('/api/bff/tenants/t1/events/e1/report');
    assert.equal(result.status, 403);
    assert.deepEqual(paths, ['/api/bff/tenants/t1/events/e1/report']);
  } finally {
    fetchMock.mock.restore();
    restoreDocument();
    if (previousWindow === undefined) {
      delete (globalThis as { window?: Window }).window;
    } else {
      (globalThis as { window?: Window }).window = previousWindow;
    }
  }
});

test('portal mutation exposes BFF Retry-After', async () => {
  const restoreDocument = installActorDocument();
  const fetchMock = mock.method(globalThis, 'fetch', async (input: string) => responseForActor(input, new Response('{"retryable":true}', {
    status: 429,
    headers: { ...bindingHeaders, 'Retry-After': '3' },
  })));
  try {
    const result = await portalMutate('/api/bff/tenants/t1/events', { idempotencyKey: 'key-a' });
    assert.equal(result.retryAfterMs, 3000);
    assert.equal(result.status, 429);
  } finally {
    fetchMock.mock.restore();
    restoreDocument();
  }
});

test('a late private response is dropped when the marker changes', async () => {
  const restoreDocument = installActorDocument();
  let release!: (response: Response) => void;
  const held = new Promise<Response>((resolve) => { release = resolve; });
  const fetchMock = mock.method(globalThis, 'fetch', async (input: string) =>
    input.startsWith('/api/auth/identity')
      ? responseForActor(input, new Response())
      : held);
  try {
    const request = portalGet('/api/bff/tenants/t1/events');
    await new Promise((resolve) => setImmediate(resolve));
    (globalThis.document as { cookie: string }).cookie = 'portal_staff_epoch=epoch-b';
    release(new Response('{"items":[{"private":"A"}]}', { headers: bindingHeaders }));
    const result = await request;
    assert.equal(result.status, 401);
    assert.equal(result.json && JSON.stringify(result.json).includes('private'), false);
  } finally {
    fetchMock.mock.restore();
    restoreDocument();
  }
});

test('late 403 from tenant A hides A event without blanking tenant B', () => {
  const eventScope = forbiddenScopeFromBffPath(
    '/api/bff/tenants/A/events/e1/report',
  );
  assert.deepEqual(eventScope, { tenantId: 'A', eventId: 'e1' });
  assert.equal(forbiddenScopeAffectsPath(eventScope!, '/t/A/e/e1/gate'), true);
  assert.equal(forbiddenScopeAffectsPath(eventScope!, '/t/A/e/e2/gate'), false);
  assert.equal(forbiddenScopeAffectsPath(eventScope!, '/t/B/e/e1/gate'), false);
  const tenantScope = forbiddenScopeFromBffPath(
    '/api/bff/tenants/A/reports/portfolio',
  );
  assert.deepEqual(tenantScope, { tenantId: 'A', eventId: null });
  assert.equal(forbiddenScopeAffectsPath(tenantScope!, '/t/B'), false);
  assert.equal(forbiddenScopeAffectsPath(tenantScope!, '/t/A/analytics'), true);
});

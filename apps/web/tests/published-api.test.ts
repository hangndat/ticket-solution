import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadPublishedEventDetail,
  loadPublishedEventList,
} from '../src/published';

const summary = {
  id: '11111111-1111-4111-8111-111111111101',
  tenantSlug: 'mfest-demo',
  slug: 'mfest',
  name: 'MFest · Demo',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2027-03-20T10:00:00+07:00',
  location: 'Demo riverside',
  publishedConfigVersion: 1,
  schemaVersion: 1,
  brand: { primaryColor: '#783013', organizationName: 'MFest · Demo' },
};

const detail = {
  ...summary,
  sections: [],
  faq: [],
  terms: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('loadPublishedEventList maps ok / unreachable / invalid', async () => {
  const ok = await loadPublishedEventList('mfest-demo', {
    revalidateSeconds: 0,
    fetchImpl: async () =>
      jsonResponse(200, { items: [summary], nextCursor: null }),
  });
  assert.equal(ok.status, 'ok');
  if (ok.status === 'ok') assert.equal(ok.body.items.length, 1);

  const down = await loadPublishedEventList('mfest-demo', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(502, { code: 'UPSTREAM' }),
  });
  assert.equal(down.status, 'unreachable');

  const bad = await loadPublishedEventList('mfest-demo', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(200, { items: [{ nope: true }] }),
  });
  assert.equal(bad.status, 'invalid');
});

test('loadPublishedEventDetail never invents fixture on 404 / network', async () => {
  const missing = await loadPublishedEventDetail('mfest-demo', 'missing', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(404, { code: 'NOT_FOUND' }),
  });
  assert.equal(missing.status, 'not-found');

  const ok = await loadPublishedEventDetail('mfest-demo', 'mfest', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(200, detail),
  });
  assert.equal(ok.status, 'ok');

  const boom = await loadPublishedEventDetail('mfest-demo', 'mfest', {
    revalidateSeconds: 0,
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  assert.equal(boom.status, 'unreachable');
});

test('empty tenant/slug is invalid without calling network', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return jsonResponse(200, detail);
  };
  assert.equal(
    (await loadPublishedEventDetail('', 'x', { fetchImpl, revalidateSeconds: 0 }))
      .status,
    'invalid',
  );
  assert.equal(called, false);
});

 test('429 is retryable and a subsequent load reaches the upstream again', async () => {
  for (const load of [
    (fetchImpl: typeof fetch) => loadPublishedEventList('mfest-demo', { fetchImpl }),
    (fetchImpl: typeof fetch) => loadPublishedEventDetail('mfest-demo', 'mfest', { fetchImpl }),
  ]) {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls++;
      if (calls === 1) return jsonResponse(429, { code: 'RATE_LIMITED' });
      return jsonResponse(200, String(input).endsWith('/mfest') ? detail : { items: [summary], nextCursor: null });
    };
    assert.equal((await load(fetchImpl)).status, 'rate-limited');
    assert.equal(calls, 1);
    assert.equal((await load(fetchImpl)).status, 'ok');
    assert.equal(calls, 2);
  }
});

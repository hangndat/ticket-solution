import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadPublishedEventDetail,
  loadPublishedEventList,
} from '../src/published';

const summary = {
  id: '11111111-1111-4111-8111-111111111101',
  tenantSlug: 'demo-fun',
  slug: 'fun-fest',
  name: 'FUN FEST · Demo',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2027-03-20T10:00:00+07:00',
  location: 'Demo riverside',
  publishedConfigVersion: 1,
  schemaVersion: 1,
  brand: { primaryColor: '#783013', organizationName: 'FUN Collective · Demo' },
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
  const ok = await loadPublishedEventList('demo-fun', {
    revalidateSeconds: 0,
    fetchImpl: async () =>
      jsonResponse(200, { items: [summary], nextCursor: null }),
  });
  assert.equal(ok.status, 'ok');
  if (ok.status === 'ok') assert.equal(ok.body.items.length, 1);

  const down = await loadPublishedEventList('demo-fun', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(502, { code: 'UPSTREAM' }),
  });
  assert.equal(down.status, 'unreachable');

  const bad = await loadPublishedEventList('demo-fun', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(200, { items: [{ nope: true }] }),
  });
  assert.equal(bad.status, 'invalid');
});

test('loadPublishedEventDetail never invents fixture on 404 / network', async () => {
  const missing = await loadPublishedEventDetail('demo-fun', 'missing', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(404, { code: 'NOT_FOUND' }),
  });
  assert.equal(missing.status, 'not-found');

  const ok = await loadPublishedEventDetail('demo-fun', 'fun-fest', {
    revalidateSeconds: 0,
    fetchImpl: async () => jsonResponse(200, detail),
  });
  assert.equal(ok.status, 'ok');

  const boom = await loadPublishedEventDetail('demo-fun', 'fun-fest', {
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

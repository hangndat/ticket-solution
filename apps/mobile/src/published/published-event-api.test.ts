import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchPlatformPublishedEventList,
  fetchPublishedEventDetail,
  fetchPublishedEventList,
  isPublishedEventDetail,
  visibleSectionsInOrder,
} from './published-event-api.ts';
import { VEMOKI_PROD_API_BASE_URL } from '../identity/config.ts';
import type { PublishedEventDetail } from './types.ts';

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

const sampleDetail: PublishedEventDetail = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  tenantSlug: 'acme',
  slug: 'spring-fest',
  name: 'Spring Fest',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2027-03-20T10:00:00+07:00',
  location: 'Park',
  publishedConfigVersion: 3,
  schemaVersion: 1,
  sections: [
    {
      id: 's-faq',
      kind: 'faq',
      visible: true,
      order: 2,
      title: 'FAQ',
      bodyMarkdown: 'See below',
    },
    {
      id: 's-hero',
      kind: 'hero',
      visible: true,
      order: 1,
      title: 'Hero',
      bodyMarkdown: 'Welcome',
    },
    {
      id: 's-hidden',
      kind: 'guide',
      visible: false,
      order: 0,
      title: 'Hidden',
    },
  ],
  faq: [{ q: 'Bags?', a: 'Small bags only' }],
  terms: { version: 't-1', bodyMarkdown: 'Be kind' },
  brand: {
    primaryColor: '#245B47',
    organizationName: 'Acme Org',
    contact: 'hello@example.com',
  },
};

test('isPublishedEventDetail accepts freeze shape and rejects draft-like junk', () => {
  assert.equal(isPublishedEventDetail(sampleDetail), true);
  assert.equal(
    isPublishedEventDetail({ ...sampleDetail, startsAt: null, location: null }),
    true,
  );
  assert.equal(
    isPublishedEventDetail({
      ...sampleDetail,
      sections: [{ id: 'x', kind: 'script', visible: true, order: 0 }],
    }),
    false,
  );
});

test('visibleSectionsInOrder filters and sorts', () => {
  const visible = visibleSectionsInOrder(sampleDetail);
  assert.deepEqual(
    visible.map((s) => s.id),
    ['s-hero', 's-faq'],
  );
});

test('fetchPublishedEventDetail maps 200/404 and never invents demo', async () => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  const ok = await fetchPublishedEventDetail(
    'acme',
    'spring-fest',
    undefined,
    mockFetch(async (url) => {
      assert.match(url, /\/v1\/public\/tenants\/acme\/events\/spring-fest$/);
      return new Response(JSON.stringify(sampleDetail), { status: 200 });
    }),
  );
  assert.equal(ok.status, 'ok');

  const notFound = await fetchPublishedEventDetail(
    'acme',
    'draft-only',
    undefined,
    mockFetch(async () => new Response('', { status: 404 })),
  );
  assert.equal(notFound.status, 'not-found');
});

test('fetchPlatformPublishedEventList hits /v1/public/events', async () => {
  const result = await fetchPlatformPublishedEventList(
    { limit: 5 },
    undefined,
    mockFetch(async (url) => {
      assert.match(url, new RegExp(`^${VEMOKI_PROD_API_BASE_URL}/v1/public/events\\?`));
      return new Response(
        JSON.stringify({
          items: [
            {
              id: sampleDetail.id,
              tenantSlug: sampleDetail.tenantSlug,
              slug: sampleDetail.slug,
              name: sampleDetail.name,
              timezone: sampleDetail.timezone,
              startsAt: sampleDetail.startsAt,
              location: sampleDetail.location,
              publishedConfigVersion: 3,
              schemaVersion: 1,
              brand: sampleDetail.brand,
            },
          ],
          nextCursor: 'opaque-cursor',
        }),
        { status: 200 },
      );
    }),
  );
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.body.items.length, 1);
    assert.equal(result.body.nextCursor, 'opaque-cursor');
  }
});

test('fetchPublishedEventList validates items and nextCursor', async () => {
  const result = await fetchPublishedEventList(
    'acme',
    { limit: 10 },
    undefined,
    mockFetch(async (url) => {
      assert.match(url, /\/v1\/public\/tenants\/acme\/events\?/);
      return new Response(
        JSON.stringify({
          items: [
            {
              id: sampleDetail.id,
              tenantSlug: sampleDetail.tenantSlug,
              slug: sampleDetail.slug,
              name: sampleDetail.name,
              timezone: sampleDetail.timezone,
              startsAt: sampleDetail.startsAt,
              location: sampleDetail.location,
              publishedConfigVersion: 3,
              schemaVersion: 1,
              brand: sampleDetail.brand,
            },
          ],
          nextCursor: null,
        }),
        { status: 200 },
      );
    }),
  );
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.body.items.length, 1);
    assert.equal(result.body.nextCursor, null);
  }
});

test('demo fixtures are not used when published fetch fails (caller contract)', async () => {
  const down = await fetchPublishedEventDetail(
    'acme',
    'spring-fest',
    undefined,
    mockFetch(async () => {
      throw new TypeError('offline');
    }),
  );
  assert.equal(down.status, 'unreachable');
  // Callers must not call findDemoEvent as fallback for this status.
});

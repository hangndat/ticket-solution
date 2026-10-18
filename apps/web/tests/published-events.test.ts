import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPublishedEventDate,
  heroCopyFromSections,
  homeTenantSlugs,
  isExplicitDemoLabel,
  isPublishedEventDetail,
  isPublishedEventSummary,
  parsePublishedEventList,
  publishedEventHref,
} from '../src/published';

const validSummary = {
  id: '11111111-1111-4111-8111-111111111101',
  tenantSlug: 'mfest-demo',
  slug: 'mfest',
  name: 'MFest · Demo',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2027-03-20T10:00:00+07:00',
  location: 'Demo riverside venue',
  publishedConfigVersion: 1,
  schemaVersion: 1,
  brand: {
    primaryColor: '#783013',
    organizationName: 'MFest · Demo',
  },
};

const validDetail = {
  ...validSummary,
  sections: [
    {
      id: 'sec-hero',
      kind: 'hero',
      visible: true,
      order: 0,
      title: 'Music / Community',
      bodyMarkdown: 'A little louder.',
    },
    {
      id: 'sec-hidden',
      kind: 'info',
      visible: false,
      order: 1,
      title: 'Hidden',
      bodyMarkdown: 'Nope',
    },
  ],
  faq: [{ q: 'Vé?', a: 'Đổi mã.' }],
  terms: null,
};

test('homeTenantSlugs defaults to D9 seed tenants', () => {
  assert.deepEqual(homeTenantSlugs({}), ['mfest-demo', 'demo-studio']);
});

test('homeTenantSlugs parses PUBLIC_HOME_TENANT_SLUGS and drops junk', () => {
  assert.deepEqual(
    homeTenantSlugs({ PUBLIC_HOME_TENANT_SLUGS: 'acme, BAD_Slug, ok-org' }),
    ['acme', 'ok-org'],
  );
  assert.deepEqual(
    homeTenantSlugs({ PUBLIC_HOME_TENANT_SLUGS: ',,, ' }),
    ['mfest-demo', 'demo-studio'],
  );
});

test('publishedEventHref encodes tenant and event slug', () => {
  assert.equal(
    publishedEventHref({ tenantSlug: 'mfest-demo', slug: 'mfest' }),
    '/t/mfest-demo/events/mfest',
  );
});

test('isPublishedEventSummary / Detail reject incomplete payloads', () => {
  assert.equal(isPublishedEventSummary(validSummary), true);
  assert.equal(isPublishedEventSummary({ ...validSummary, id: '' }), false);
  assert.equal(isPublishedEventDetail(validDetail), true);
  assert.equal(
    isPublishedEventDetail({ ...validDetail, sections: 'nope' }),
    false,
  );
});

test('parsePublishedEventList fail-closed on bad items', () => {
  assert.deepEqual(parsePublishedEventList({ items: [validSummary], nextCursor: null }), {
    items: [validSummary],
    nextCursor: null,
  });
  assert.equal(parsePublishedEventList({ items: [{ bad: true }], nextCursor: null }), null);
  assert.equal(parsePublishedEventList(null), null);
});

test('heroCopyFromSections reads visible hero only', () => {
  assert.deepEqual(heroCopyFromSections(validDetail.sections), {
    eyebrow: 'Music / Community',
    intro: 'A little louder.',
  });
});

test('isExplicitDemoLabel detects D9 marker', () => {
  assert.equal(isExplicitDemoLabel('MFest · Demo'), true);
  assert.equal(isExplicitDemoLabel('Live Org'), false);
});

test('formatPublishedEventDate uses timezone; null startsAt stays null', () => {
  assert.equal(formatPublishedEventDate(null, 'Asia/Ho_Chi_Minh'), null);
  const label = formatPublishedEventDate(
    '2027-03-20T10:00:00+07:00',
    'Asia/Ho_Chi_Minh',
  );
  assert.ok(label);
  assert.match(label!, /2027/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PUBLISHED_LIST_FAIL_CLOSED_MESSAGE,
  initialPublishedListPhase,
  publishedListStateFromResult,
  selectPublishedCatalog,
} from './events-home.ts';
import type { FetchPublishedListResult } from './published-event-api.ts';
import { PUBLISHED_SECTION_KINDS } from './types.ts';

const sampleSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: 'd9d9f001-0000-4000-8000-000000000001',
  tenantSlug: 'mfest-demo',
  slug: 'mfest',
  name: 'MFest',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2027-03-20T10:00:00+07:00',
  location: 'Park',
  publishedConfigVersion: 1,
  schemaVersion: 1,
  brand: {
    primaryColor: '#245B47',
    organizationName: 'MFest · Demo',
  },
};

test('initial phase is loading when API configured, else misconfigured', () => {
  assert.equal(initialPublishedListPhase(true), 'loading');
  assert.equal(initialPublishedListPhase(false), 'misconfigured');
});

test('ok result populates items without inventing demo rows', () => {
  const result: FetchPublishedListResult = {
    status: 'ok',
    body: { items: [sampleSummary], nextCursor: null },
  };
  const state = publishedListStateFromResult(result);
  assert.equal(state.phase, 'ready');
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0]?.slug, 'mfest');
  assert.equal(state.errorMessage, null);
});

test('empty ok list stays empty — fail-closed, no fixture fill', () => {
  const result: FetchPublishedListResult = {
    status: 'ok',
    body: { items: [], nextCursor: null },
  };
  const state = publishedListStateFromResult(result);
  assert.equal(state.phase, 'ready');
  assert.deepEqual(state.items, []);
});

test('catalog search has its own empty state and ranks upcoming events first', () => {
  const later = { ...sampleSummary, id: 'later', name: 'Studio Night', startsAt: '2027-03-22T10:00:00+07:00' };
  const sooner = { ...sampleSummary, id: 'sooner', name: 'MFest', startsAt: '2027-03-20T10:00:00+07:00' };
  const catalog = selectPublishedCatalog([later, sooner], '', Date.parse('2027-03-01'));
  assert.deepEqual(catalog.matches.map((item) => item.id), ['sooner', 'later']);
  assert.equal(catalog.emptyKind, null);
  assert.equal(selectPublishedCatalog([], '', Date.parse('2027-03-01')).emptyKind, 'catalog');
  assert.equal(selectPublishedCatalog([sooner], 'không có', Date.parse('2027-03-01')).emptyKind, 'search');
  assert.equal(selectPublishedCatalog([sooner], 'mfest', Date.parse('2027-03-01')).matches.length, 1);
});

test('unreachable and invalid clear items and keep fail-closed message', () => {
  for (const status of ['unreachable', 'invalid'] as const) {
    const state = publishedListStateFromResult({ status });
    assert.equal(state.phase, 'error');
    assert.deepEqual(state.items, []);
    assert.equal(state.errorMessage, PUBLISHED_LIST_FAIL_CLOSED_MESSAGE);
    assert.match(state.errorMessage ?? '', /không dùng demo/i);
  }
});

test('misconfigured clears items', () => {
  const state = publishedListStateFromResult({ status: 'misconfigured' });
  assert.equal(state.phase, 'misconfigured');
  assert.deepEqual(state.items, []);
});

test('local PUBLISHED_SECTION_KINDS matches ADR-19 contract kinds', () => {
  assert.deepEqual([...PUBLISHED_SECTION_KINDS], [
    'hero',
    'info',
    'redeem',
    'guide',
    'faq',
    'terms',
  ]);
});

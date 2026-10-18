import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEMO_PUBLISHED_TENANTS,
  PUBLISHED_LIST_FAIL_CLOSED_MESSAGE,
  initialPublishedListPhase,
  nextDemoPublishedTenant,
  publishedListStateFromResult,
} from './events-home.ts';
import type { FetchPublishedListResult } from './published-event-api.ts';
import { PUBLISHED_SECTION_KINDS } from './types.ts';

const sampleSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantSlug: 'demo-fun',
  slug: 'fun-fest',
  name: 'FUN FEST',
  timezone: 'Asia/Ho_Chi_Minh',
  startsAt: '2027-03-20T10:00:00+07:00',
  location: 'Park',
  publishedConfigVersion: 1,
  schemaVersion: 1,
  brand: {
    primaryColor: '#245B47',
    organizationName: 'Demo FUN Collective',
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
  assert.equal(state.items[0]?.slug, 'fun-fest');
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

test('tenant toggle cycles seed demo published tenants', () => {
  assert.equal(nextDemoPublishedTenant('demo-fun'), 'demo-studio');
  assert.equal(nextDemoPublishedTenant('demo-studio'), 'demo-fun');
  assert.deepEqual([...DEMO_PUBLISHED_TENANTS], ['demo-fun', 'demo-studio']);
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

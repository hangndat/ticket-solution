import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  eventMatchesTimeFilter,
  type HomeCatalogItem,
} from '../src/home-catalog/catalog-utils';

function item(startsAt: string | null): HomeCatalogItem {
  return {
    id: 'e1',
    tenantSlug: 'demo',
    slug: 'evt',
    name: 'Demo',
    timezone: 'Asia/Ho_Chi_Minh',
    startsAt,
    location: null,
    brand: { organizationName: 'Org' },
  };
}

describe('home catalog time filter (R-09 / AC-4)', () => {
  it('eventMatchesTimeFilter splits upcoming vs past vs all', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    assert.equal(eventMatchesTimeFilter(item(future), 'upcoming'), true);
    assert.equal(eventMatchesTimeFilter(item(future), 'past'), false);
    assert.equal(eventMatchesTimeFilter(item(past), 'past'), true);
    assert.equal(eventMatchesTimeFilter(item(past), 'upcoming'), false);
    assert.equal(eventMatchesTimeFilter(item(past), 'all'), true);
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spaceGenerated as space } from '../theme/tokens.generated.ts';
import {
  EVENT_BANNER_HEIGHT_DETAIL,
  EVENT_BANNER_HEIGHT_LIST,
  EVENT_BANNER_HEIGHT_TICKET,
} from './event-banner-metrics.ts';

test('event banners share one modest height rhythm', () => {
  assert.equal(EVENT_BANNER_HEIGHT_LIST, space.huge * 2 + space.lg);
  assert.equal(EVENT_BANNER_HEIGHT_TICKET, EVENT_BANNER_HEIGHT_LIST);
  assert.equal(EVENT_BANNER_HEIGHT_DETAIL, space.huge * 3 + space.sm);
  assert.ok(EVENT_BANNER_HEIGHT_DETAIL > EVENT_BANNER_HEIGHT_LIST);
  assert.ok(EVENT_BANNER_HEIGHT_DETAIL - EVENT_BANNER_HEIGHT_LIST <= space.huge);
});

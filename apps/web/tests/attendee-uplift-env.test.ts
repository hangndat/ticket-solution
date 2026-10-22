import assert from 'node:assert/strict';
import test from 'node:test';
import { isDemoDataStripEnabled } from '../src/attendee-uplift/env';

test('isDemoDataStripEnabled respects DEMO_DATA_STRIP / NEXT_PUBLIC', () => {
  assert.equal(isDemoDataStripEnabled({}), false);
  assert.equal(isDemoDataStripEnabled({ DEMO_DATA_STRIP: '1' }), true);
  assert.equal(isDemoDataStripEnabled({ NEXT_PUBLIC_DEMO_DATA_STRIP: 'true' }), true);
  assert.equal(isDemoDataStripEnabled({ DEMO_DATA_STRIP: '0' }), false);
});

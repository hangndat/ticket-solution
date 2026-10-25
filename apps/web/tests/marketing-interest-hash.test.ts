import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INTEREST_HASH,
  isInterestHref,
} from '../src/marketing/marketing-interest-hash';

describe('marketing-interest-hash', () => {
  it('recognizes interest href variants', () => {
    assert.equal(isInterestHref('#interest'), true);
    assert.equal(isInterestHref('/marketing#interest'), true);
    assert.equal(isInterestHref('https://vemoki.com/marketing/en#interest'), true);
    assert.equal(isInterestHref('#product'), false);
    assert.equal(INTEREST_HASH, '#interest');
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EVENT_IDENTITY_PALETTE,
  eventIdentityColor,
  eventInitial,
  isEventBrandHexColor,
} from './event-identity.ts';

test('same event id always yields the same color', () => {
  assert.equal(eventIdentityColor('evt-x'), eventIdentityColor('evt-x'));
  assert.equal(
    eventIdentityColor('evt-x', 'not-a-color'),
    eventIdentityColor('evt-x'),
  );
});

test('different event ids diverge across the palette', () => {
  const a = eventIdentityColor('evt-alpha');
  const b = eventIdentityColor('evt-beta-other');
  assert.ok(EVENT_IDENTITY_PALETTE.includes(a as (typeof EVENT_IDENTITY_PALETTE)[number]));
  assert.ok(EVENT_IDENTITY_PALETTE.includes(b as (typeof EVENT_IDENTITY_PALETTE)[number]));
  // Probe enough ids that at least two palette slots appear.
  const seen = new Set(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => eventIdentityColor(id)),
  );
  assert.ok(seen.size >= 2);
  assert.notEqual(a, b);
});

test('demo / authored brand color overrides the hash', () => {
  assert.equal(eventIdentityColor('demo-mfest', '#245B47'), '#245B47');
  assert.equal(eventIdentityColor('demo-studio-night', '#59428A'), '#59428A');
  assert.equal(eventIdentityColor('evt-x', '#112233'), '#112233');
  assert.equal(eventIdentityColor('evt-x', '#abc'), '#abc');
});

test('isEventBrandHexColor accepts 3/6 hex only', () => {
  assert.equal(isEventBrandHexColor('#245B47'), true);
  assert.equal(isEventBrandHexColor('#abc'), true);
  assert.equal(isEventBrandHexColor('245B47'), false);
  assert.equal(isEventBrandHexColor('rgb(1,2,3)'), false);
});

test('eventInitial uses first grapheme, Vietnamese uppercased', () => {
  assert.equal(eventInitial('  đêm nhạc'), 'Đ');
  assert.equal(eventInitial('MFest · Demo'), 'M');
  assert.equal(eventInitial(''), 'S');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PORTAL_LOCALE } from '../src/i18n';
import { portalLocaleFromCookieValue } from '../src/i18n/locale-server';

test('portalLocaleFromCookieValue defaults without cookie', () => {
  assert.equal(portalLocaleFromCookieValue(undefined), DEFAULT_PORTAL_LOCALE);
  assert.equal(portalLocaleFromCookieValue(null), DEFAULT_PORTAL_LOCALE);
  assert.equal(portalLocaleFromCookieValue(''), DEFAULT_PORTAL_LOCALE);
});

test('portalLocaleFromCookieValue maps vemoki_portal_locale en|vi for SSR lang', () => {
  assert.equal(portalLocaleFromCookieValue('en'), 'en');
  assert.equal(portalLocaleFromCookieValue(' EN '), 'en');
  assert.equal(portalLocaleFromCookieValue('vi'), 'vi');
  assert.equal(portalLocaleFromCookieValue('garbage'), DEFAULT_PORTAL_LOCALE);
});

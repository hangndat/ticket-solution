import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  ATTENDEE_LOCALE_STORAGE_KEY,
  DEFAULT_ATTENDEE_LOCALE,
  EN,
  VI,
  isMessageKey,
  navLabelForTestId,
  parseAttendeeLocale,
  readStoredAttendeeLocale,
  t,
  writeStoredAttendeeLocale,
} from '../src/i18n';
import { buildNavLinks } from '../src/nav/capabilities';

test('guest chrome has in-app locale toggle (not marketing /en)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const chrome = readFileSync(join(root, 'src/site-chrome.tsx'), 'utf8');
  const sw = readFileSync(join(root, 'src/i18n/locale-switch.tsx'), 'utf8');
  assert.match(chrome, /AttendeeLocaleSwitch/);
  assert.match(sw, /data-testid="attendee-locale-en"/);
  assert.doesNotMatch(sw, /href=["']\/en["']/);
});

test('default attendee locale is vi (O04)', () => {
  assert.equal(DEFAULT_ATTENDEE_LOCALE, 'vi');
  assert.equal(parseAttendeeLocale(undefined), 'vi');
  assert.equal(parseAttendeeLocale('en'), 'en');
  assert.equal(parseAttendeeLocale('en-US'), 'en');
});

test('attendee catalogs have matching keys and EN has no VI leakage except names', () => {
  const viKeys = Object.keys(VI).sort();
  const enKeys = Object.keys(EN).sort();
  assert.deepEqual(enKeys, viKeys);
  assert.notEqual(t('vi', 'nav.login'), t('en', 'nav.login'));
  assert.equal(t('vi', 'nav.login'), 'Đăng nhập');
  assert.equal(t('en', 'nav.login'), 'Sign in');
  assert.equal(t('en', 'home.browse'), 'Explore events');
  for (const key of viKeys) {
    assert.ok(isMessageKey(key));
  }
});

test('nav labels remap by testId without changing hrefs', () => {
  const guest = buildNavLinks({ authenticated: false, showAccount: false });
  assert.deepEqual(
    guest.map((l) => l.href),
    ['/', '/redeem', '/api/auth/login?return=%2Fwallet'],
  );
  assert.equal(navLabelForTestId('nav-login', 'en', 'Đăng nhập'), 'Sign in');
  assert.equal(navLabelForTestId('nav-events', 'en', 'Khám phá'), 'Explore');
  assert.equal(navLabelForTestId('nav-unknown', 'en', 'keep'), 'keep');
});

test('attendee locale storage round-trip', () => {
  const g = globalThis as unknown as { localStorage?: Storage };
  const prev = g.localStorage;
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  try {
    assert.equal(readStoredAttendeeLocale(), 'vi');
    writeStoredAttendeeLocale('en');
    assert.equal(store.get(ATTENDEE_LOCALE_STORAGE_KEY), 'en');
    assert.equal(readStoredAttendeeLocale(), 'en');
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
});

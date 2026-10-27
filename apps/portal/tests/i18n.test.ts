import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PORTAL_LOCALE,
  PORTAL_LOCALE_STORAGE_KEY,
  isMessageKey,
  isPortalLocale,
  parsePortalLocale,
  readStoredPortalLocale,
  writeStoredPortalLocale,
} from '../src/i18n';
import { EN, VI, VI_TO_KEY } from '../src/i18n/messages';
import { t } from '../src/i18n/t';

const VI_CHARS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function silenceWarn<T>(fn: () => T): T {
  const original = console.warn;
  console.warn = () => undefined;
  try {
    return fn();
  } finally {
    console.warn = original;
  }
}

test('default locale is vi', () => {
  assert.equal(DEFAULT_PORTAL_LOCALE, 'vi');
  assert.equal(parsePortalLocale(undefined), 'vi');
  assert.equal(parsePortalLocale(null), 'vi');
  assert.equal(parsePortalLocale('fr'), 'vi');
});

test('parsePortalLocale normalizes vi / en variants', () => {
  assert.equal(parsePortalLocale('en'), 'en');
  assert.equal(parsePortalLocale(' EN '), 'en');
  assert.equal(parsePortalLocale('en-US'), 'en');
  assert.equal(parsePortalLocale('en_us'), 'en');
  assert.equal(parsePortalLocale('vi'), 'vi');
  assert.equal(parsePortalLocale('vi-VN'), 'vi');
  assert.equal(parsePortalLocale('xx', 'en'), 'en');
  assert.equal(isPortalLocale('en'), true);
  assert.equal(isPortalLocale('de'), false);
});

test('t(vi) / t(en) return the matching catalog value', () => {
  assert.equal(t('vi', 'shell.account.menu'), 'Tài khoản ▾');
  assert.equal(t('en', 'shell.account.menu'), 'Account ▾');
  assert.equal(t('vi', 'locale.label'), 'Ngôn ngữ');
  assert.equal(t('en', 'locale.label'), 'Language');
  assert.equal(t('vi', 'locale.vi'), 'Tiếng Việt');
  assert.equal(t('en', 'locale.en'), 'English');
});

test('t interpolates {{vars}} in both locales', () => {
  assert.equal(t('vi', 'common.httpStatus', { status: 503 }), 'HTTP 503');
  assert.equal(t('en', 'common.httpStatus', { status: 503 }), 'HTTP 503');
  assert.equal(
    t('en', 'common.cloneName', { name: 'Demo' }).includes('Demo'),
    true,
  );
  // null / undefined vars render empty, never "undefined"
  assert.equal(
    t('vi', 'common.cloneName', { name: undefined }).includes('undefined'),
    false,
  );
});

test('unknown key starts with [VI] and never throws', () => {
  silenceWarn(() => {
    assert.ok(t('en', 'does.not.exist').startsWith('[VI]'));
    assert.ok(t('vi', 'does.not.exist').startsWith('[VI]'));
  });
  assert.equal(isMessageKey('does.not.exist'), false);
  assert.equal(isMessageKey('shell.account.menu'), true);
});

test('missing EN value falls back to VI (never blank)', () => {
  const key = 'shell.account.logout';
  const en = EN as Record<string, string>;
  const saved = en[key]!;
  try {
    en[key] = '';
    silenceWarn(() => {
      assert.equal(t('en', key), VI[key as keyof typeof VI]);
    });
  } finally {
    en[key] = saved;
  }
  assert.equal(t('en', key), saved);
});

test('catalog parity: every VI key exists in EN and vice versa', () => {
  const viKeys = Object.keys(VI).sort();
  const enKeys = Object.keys(EN).sort();
  assert.deepEqual(enKeys, viKeys);
  for (const key of viKeys) {
    assert.ok((VI as Record<string, string>)[key]!.length > 0, `VI empty: ${key}`);
    assert.ok((EN as Record<string, string>)[key]!.length > 0, `EN empty: ${key}`);
  }
});

test('VI_TO_KEY parity: every VI value maps to a key present in EN', () => {
  for (const [key, viValue] of Object.entries(VI)) {
    const mapped = (VI_TO_KEY as Record<string, string>)[viValue];
    assert.ok(mapped, `no VI_TO_KEY entry for ${key}: ${viValue}`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(EN, mapped),
      `VI_TO_KEY target ${mapped} missing in EN`,
    );
    assert.equal(
      (VI as Record<string, string>)[mapped],
      viValue,
      `VI_TO_KEY maps ${JSON.stringify(viValue)} to ${mapped} with a different VI value`,
    );
  }
  for (const [literal, key] of Object.entries(VI_TO_KEY)) {
    assert.ok(Object.prototype.hasOwnProperty.call(EN, key), `EN missing ${key}`);
    assert.equal((VI as Record<string, string>)[key], literal);
  }
});

test('placeholders are preserved between VI and EN', () => {
  const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort();
  for (const key of Object.keys(VI)) {
    assert.deepEqual(
      vars((EN as Record<string, string>)[key]!),
      vars((VI as Record<string, string>)[key]!),
      `placeholder mismatch: ${key}`,
    );
  }
});

test('EN catalog has no Vietnamese leakage (except native locale name)', () => {
  const leaks = Object.entries(EN)
    .filter(([key, value]) => key !== 'locale.vi' && VI_CHARS.test(value))
    .map(([key]) => key);
  assert.deepEqual(leaks, []);
});

test('shell + nav keys required for AC-PS3 / AC-C1 exist in both locales', () => {
  const keys = [
    'shell.account.menu',
    'shell.account.security',
    'shell.account.logout',
    'locale.label',
    'locale.vi',
    'locale.en',
    'nav.org.overview',
    'nav.org.events',
    'nav.org.analytics',
    'nav.org.members',
    'nav.org.settings',
    'nav.event.overview',
    'nav.event.setup',
    'nav.event.gate',
    'shell.load.serverUnreachable',
    'shell.load.unknownConnection',
  ] as const;
  for (const key of keys) {
    assert.ok(isMessageKey(key), key);
    assert.notEqual(t('vi', key).startsWith('[VI]'), true);
    assert.notEqual(t('en', key).startsWith('[VI]'), true);
  }
  assert.notEqual(t('vi', 'nav.org.overview'), t('en', 'nav.org.overview'));
});

test('locale storage round-trip (no DOM: localStorage stub, default without cookie)', () => {
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
    assert.equal(readStoredPortalLocale(), 'vi');
    writeStoredPortalLocale('en');
    assert.equal(store.get(PORTAL_LOCALE_STORAGE_KEY), 'en');
    assert.equal(readStoredPortalLocale(), 'en');
    writeStoredPortalLocale('vi');
    assert.equal(readStoredPortalLocale(), 'vi');
    store.set(PORTAL_LOCALE_STORAGE_KEY, 'garbage');
    assert.equal(readStoredPortalLocale(), 'vi');
  } finally {
    if (prev === undefined) delete g.localStorage;
    else g.localStorage = prev;
  }
});

test('S5 user copy on touched screens has no raw API codes', () => {
  const keys = [
    'members.roles.lastOwnerBody',
    'limits.guidance.resendLimitBody',
    'limits.guidance.tenantReachedBody',
    'overview.help',
    'members.help',
  ] as const;
  for (const key of keys) {
    assert.doesNotMatch(t('vi', key), /LAST_OWNER_REQUIRED|RESEND_LIMIT|TENANT_LIMIT_REACHED|MembershipRole/);
    assert.doesNotMatch(t('en', key), /LAST_OWNER_REQUIRED|RESEND_LIMIT|TENANT_LIMIT_REACHED|MembershipRole/);
  }
});

test('ops helpers: locale param switches catalog, default stays vi', async () => {
  const { interpretPendingList, pendingListLabel } = await import('../src/ops/pending');
  const vi = interpretPendingList(503, null, false);
  const en = interpretPendingList(503, null, false, 'en');
  assert.equal(vi.kind, 'unknown');
  assert.equal(en.kind, 'unknown');
  const viMsg = vi.kind === 'unknown' ? vi.message : '';
  const enMsg = en.kind === 'unknown' ? en.message : '';
  assert.equal(viMsg, t('vi', 'ops.pending.unknown'));
  assert.equal(enMsg, t('en', 'ops.pending.unknown'));
  assert.notEqual(viMsg, enMsg);
  assert.equal(pendingListLabel(en, 'en'), enMsg);

  const { derivePrepReadiness, readinessSummary } = await import('../src/prep/readiness');
  const items = derivePrepReadiness({
    hasEventContext: false,
    hasTicketType: false,
    hasSource: false,
    quotaKnown: false,
    quotaCapacity: null,
    hasTermsOrPublished: false,
    hasBrand: false,
  }, 'en');
  assert.equal(items[0]!.label, 'Ticket types');
  assert.ok(!VI_CHARS.test(readinessSummary(items, 'en')));
});

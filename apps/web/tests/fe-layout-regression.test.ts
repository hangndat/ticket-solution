import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleSwitch } from '../src/marketing/locale-switch';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('consumer layout exposes footer landmark for sticky-footer regression', () => {
  const layout = readFileSync(
    join(WEB_ROOT, 'app/(consumer)/layout.tsx'),
    'utf8',
  );
  assert.match(layout, /data-testid="site-footer"/);
  const root = readFileSync(join(WEB_ROOT, 'app/layout.tsx'), 'utf8');
  assert.match(root, /attendeeBody/);
  assert.doesNotMatch(root, /data-testid="site-footer"/);
  const removedUpliftStyles = join(WEB_ROOT, 'app', `attendee-uplift.${'css'}`);
  assert.equal(
    existsSync(removedUpliftStyles),
    false,
    'attendee uplift stylesheet must not be present (removed; styles in Tailwind/@theme)',
  );
  assert.doesNotMatch(root, /attendee-uplift\.css/);
});

test('marketing LocaleSwitch renders VI|EN toggle with active locale (SSR)', () => {
  const viHtml = renderToStaticMarkup(
    React.createElement(LocaleSwitch, { locale: 'vi', pageKind: 'sales' }),
  );
  assert.match(viHtml, /data-testid="mkt-locale-toggle"/);
  assert.match(viHtml, /data-testid="mkt-locale-vi"/);
  assert.match(viHtml, /aria-current="true"[^>]*data-testid="mkt-locale-vi"|data-testid="mkt-locale-vi"[^>]*aria-current="true"/);

  const enHtml = renderToStaticMarkup(
    React.createElement(LocaleSwitch, { locale: 'en', pageKind: 'sales' }),
  );
  assert.match(enHtml, /data-testid="mkt-locale-en"/);
  assert.match(enHtml, /aria-current="true"[^>]*data-testid="mkt-locale-en"|data-testid="mkt-locale-en"[^>]*aria-current="true"/);
});

test('marketing chrome exposes surface marker for horizontal-overflow regression', () => {
  const chrome = readFileSync(join(WEB_ROOT, 'src/marketing/chrome.tsx'), 'utf8');
  assert.match(chrome, /data-testid="marketing-surface"/);
});

test('marketing chrome places locale toggle rightmost after primary nav', () => {
  const chrome = readFileSync(join(WEB_ROOT, 'src/marketing/chrome.tsx'), 'utf8');
  assert.doesNotMatch(chrome, /MarketingDesktopInterestCta/);
  const navClose = chrome.lastIndexOf('</nav>');
  const localeIdx = chrome.indexOf('<LocaleSwitch', navClose);
  assert.ok(navClose >= 0 && localeIdx > navClose, 'LocaleSwitch must follow </nav>');
});

test('attendee home exposes surface marker for layout regression', () => {
  const page = readFileSync(join(WEB_ROOT, 'app/(consumer)/page.tsx'), 'utf8');
  assert.match(page, /data-testid="attendee-home"/);
});

test('marketing layout does not hide footer via runtime CSS hack', () => {
  const layout = readFileSync(join(WEB_ROOT, 'app/marketing/layout.tsx'), 'utf8');
  assert.doesNotMatch(layout, /display:\s*none/);
  assert.doesNotMatch(layout, /marketing-surface/);
});

test('consumer page shell keeps SiteNav outside padded main', () => {
  const shell = readFileSync(
    join(WEB_ROOT, 'src/consumer-page-shell.tsx'),
    'utf8',
  );
  assert.match(shell, /SiteNav/);
  assert.match(shell, /id="main"/);
  assert.match(shell, /SiteNav trailing={navTrailing}/);
});

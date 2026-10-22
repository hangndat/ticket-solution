import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('attendee uplift CSS pins footer with flex column + 100dvh', () => {
  const css = readFileSync(join(WEB_ROOT, 'app/attendee-uplift.css'), 'utf8');
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /margin-top:\s*auto/);
  assert.match(css, /flex:\s*1\s+0\s+auto/);
});

test('marketing uplift CSS reserves layout for locale + mobile clip', () => {
  const css = readFileSync(join(WEB_ROOT, 'app/marketing-uplift.css'), 'utf8');
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.mkt-locale a\[aria-current="true"\]/);
  assert.match(css, /\.mkt-nav-menu-toggle[\s\S]*justify-content:\s*center/);
  assert.match(css, /\.mkt-nav-desktop-only/);
  assert.match(css, /\.mkt-nav-primary-short/);
});

test('attendee uplift CSS centers mobile nav menu toggle', () => {
  const css = readFileSync(join(WEB_ROOT, 'app/attendee-uplift.css'), 'utf8');
  assert.match(css, /\.nav-menu-toggle[\s\S]*justify-content:\s*center/);
  assert.match(css, /text-wrap:\s*balance/);
});

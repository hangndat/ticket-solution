import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleSwitch } from '../src/marketing/locale-switch';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('attendee root layout exposes footer landmark for sticky-footer regression', () => {
  const layout = readFileSync(join(WEB_ROOT, 'app/layout.tsx'), 'utf8');
  assert.match(layout, /className="attendee-uplift"/);
  assert.match(layout, /data-testid="site-footer"/);
  const globals = readFileSync(join(WEB_ROOT, 'app/globals.css'), 'utf8');
  assert.match(globals, /attendee-uplift\.css' layer\(legacy\)/);
  assert.doesNotMatch(layout, /attendee-uplift\.css/);
});

test('marketing LocaleSwitch marks active locale with aria-current (SSR)', () => {
  const viHtml = renderToStaticMarkup(
    React.createElement(LocaleSwitch, { locale: 'vi', pageKind: 'sales' }),
  );
  assert.match(viHtml, /aria-current="true"/);
  assert.doesNotMatch(viHtml, /aria-current="true"[^>]*>[\s\S]*aria-current="true"/);

  const enHtml = renderToStaticMarkup(
    React.createElement(LocaleSwitch, { locale: 'en', pageKind: 'sales' }),
  );
  assert.match(enHtml, /aria-current="true"/);
});

test('marketing chrome exposes surface marker for horizontal-overflow regression', () => {
  const chrome = readFileSync(join(WEB_ROOT, 'src/marketing/chrome.tsx'), 'utf8');
  assert.match(chrome, /data-testid="marketing-surface"/);
});

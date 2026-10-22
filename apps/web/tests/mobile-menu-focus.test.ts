import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { handleMobileMenuKeyDown } from '../src/nav/mobile-menu-focus';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('handleMobileMenuKeyDown ignores non-Tab keys', () => {
  const menu = { contains: () => true } as unknown as HTMLElement;
  assert.equal(
    handleMobileMenuKeyDown({ key: 'Escape', shiftKey: false }, menu),
    false,
  );
  assert.equal(
    handleMobileMenuKeyDown({ key: 'Enter', shiftKey: false }, menu),
    false,
  );
});

test('site-chrome wires mobile menu a11y (Escape, trap, aria)', () => {
  const src = readFileSync(join(root, 'src/site-chrome.tsx'), 'utf8');
  assert.match(src, /aria-expanded=\{mobileOpen\}/);
  assert.match(src, /aria-controls="site-nav-mobile-menu"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /event\.key === 'Escape'/);
  assert.match(src, /handleMobileMenuKeyDown/);
  assert.match(src, /menuToggleRef/);
  assert.match(src, /nav-mobile-backdrop/);
  assert.match(src, /onClick=\{closeMobile\}/);
  assert.match(src, /menuToggleRef\.current\?\.focus\(\)/);
});

test('Slice G scopes button-secondary to gate-page only', () => {
  const css = readFileSync(join(root, 'app/live-pulse-legacy.css'), 'utf8');
  const slice = css.slice(
    css.indexOf('/* --- Slice G:'),
    css.indexOf('/* --- / Slice G'),
  );
  assert.match(slice, /\.gate-page \.button-secondary\s*\{/);
  assert.ok(
    !slice.match(/^\s*\.button-secondary\s*\{/m),
    'global .button-secondary must not appear in Slice G block',
  );
});

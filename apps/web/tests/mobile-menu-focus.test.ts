import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('site-chrome wires mobile menu via Radix Sheet', () => {
  const src = readFileSync(join(root, 'src/site-chrome.tsx'), 'utf8');
  assert.match(src, /@ticket\/ui\/client/);
  assert.match(src, /SheetContent/);
  assert.match(src, /aria-controls="site-nav-mobile-menu"/);
  assert.match(src, /data-testid="nav-menu-toggle"/);
  assert.match(src, /data-testid="nav-mobile-menu"/);
  assert.match(src, /overlayTestId="nav-mobile-backdrop"/);
  assert.match(src, /onNavigate=\{closeMobile\}/);
});

test('web contingency gate route tree is present', () => {
  assert.equal(existsSync(join(root, 'app/gate/page.tsx')), true);
});

test('custom mobile-menu-focus trap removed (Radix owns focus)', () => {
  assert.equal(
    existsSync(join(root, 'src/nav/mobile-menu-focus.ts')),
    false,
  );
});

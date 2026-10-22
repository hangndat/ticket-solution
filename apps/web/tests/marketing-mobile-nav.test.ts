import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('marketing mobile nav wires menu a11y (Escape, trap, aria)', () => {
  const src = readFileSync(
    join(root, 'src/marketing/marketing-mobile-nav-menu.tsx'),
    'utf8',
  );
  assert.match(src, /aria-expanded=\{open\}/);
  assert.match(src, /aria-controls=\{MENU_ID\}/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /event\.key === 'Escape'/);
  assert.match(src, /handleMobileMenuKeyDown/);
  assert.match(src, /menuToggleRef/);
  assert.match(src, /mkt-nav-mobile-backdrop/);
  assert.match(src, /onClick=\{closeMobile\}/);
  assert.match(src, /menuToggleRef\.current\?\.focus\(\)/);
});

test('marketing sales chrome wires desktop links and mobile menu toggle (SSR markers)', () => {
  const chrome = readFileSync(join(root, 'src/marketing/chrome.tsx'), 'utf8');
  const menu = readFileSync(
    join(root, 'src/marketing/marketing-mobile-nav-menu.tsx'),
    'utf8',
  );
  assert.match(chrome, /data-testid="mkt-header"/);
  assert.match(chrome, /className="mkt-nav-links"/);
  assert.match(chrome, /MarketingMobileNavMenu/);
  assert.match(menu, /data-testid="mkt-nav-menu-toggle"/);
});

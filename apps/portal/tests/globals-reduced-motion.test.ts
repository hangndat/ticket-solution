import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

describe('globals.css loading spinner (PA-06)', () => {
  it('disables spinner animation when prefers-reduced-motion is reduce', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
    assert.ok(css.includes('prefers-reduced-motion: reduce'));
    assert.ok(css.includes('.portal-surface-loading__spinner'));
    const block = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
    assert.match(block, /animation:\s*none/);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

describe('PA-01 portal header (two-tier chrome)', () => {
  it('moves tenant/event/hint out of ProLayout header into PortalContextStrip', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const layout = readFileSync(
      join(root, 'src/components/portal-pro-layout.tsx'),
      'utf8',
    );
    const strip = readFileSync(
      join(root, 'src/components/portal-context-strip.tsx'),
      'utf8',
    );
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8');

    assert.ok(layout.includes('headerContentRender={false}'));
    assert.equal(layout.includes('GateIosScanHint'), false);
    assert.ok(layout.includes('<PortalContextStrip'));
    assert.equal(strip.includes('data-testid="tenant-switcher"'), true);
    assert.equal(strip.includes('data-testid="event-switcher"'), true);
    assert.equal(strip.includes('data-testid="gate-ios-scan-hint"'), true);
    assert.ok(css.includes('.portal-brand-link'));
    assert.ok(css.includes('.portal-context-strip'));
    assert.ok(css.includes('white-space: nowrap'));
  });
});

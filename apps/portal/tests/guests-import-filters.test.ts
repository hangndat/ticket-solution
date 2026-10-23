import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

describe('Guests import catalog filters (PA-03)', () => {
  it('keeps source/type selectors inside the Import tab, not above all tabs', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const source = readFileSync(
      join(root, 'app/t/[tenantId]/e/[eventId]/guests/page.tsx'),
      'utf8',
    );
    assert.ok(source.includes("key: 'import'"));
    assert.ok(source.includes('ops.import.catalogFiltersAria'));
    assert.ok(source.includes('ImportInvitationsPanel'));
    const proCardIdx = source.indexOf('<ProCard');
    const filtersAriaIdx = source.indexOf('ops.import.catalogFiltersAria');
    assert.ok(proCardIdx >= 0);
    assert.ok(filtersAriaIdx >= 0);
    assert.ok(
      filtersAriaIdx < proCardIdx,
      'import filters should be declared before ProCard tabs wrapper',
    );
    const between = source.slice(filtersAriaIdx, proCardIdx);
    assert.equal(
      between.includes('nav.event.sources'),
      true,
      'source selector must live in import tab children',
    );
    const afterProCard = source.slice(proCardIdx);
    assert.equal(
      afterProCard.includes('nav.event.sources'),
      false,
      'source selector must not render outside tab items',
    );
  });
});

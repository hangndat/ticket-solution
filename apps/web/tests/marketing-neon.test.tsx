import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SalesPage } from '../src/marketing/sales-page';

const root = join(import.meta.dirname, '..');

describe('marketing neon sales page', () => {
  it('renders four neon blocks and interest anchor (dialog host)', () => {
    const html = renderToStaticMarkup(<SalesPage locale="vi" />);
    assert.match(html, /data-testid="marketing-neon-hero"/);
    assert.match(html, /data-testid="marketing-neon-events"/);
    assert.match(html, /data-testid="marketing-neon-product"/);
    assert.match(html, /data-testid="marketing-neon-final-cta"/);
    assert.match(html, /id="interest"/);
    assert.match(html, /hero-composite-v2\.png/);
    assert.match(html, /final-cta-crowd-v2\.png/);
    assert.doesNotMatch(html, /data-testid="marketing-bento"/);
    assert.doesNotMatch(html, /mkt-lead-section mkt-neon-interest/);
  });

  it('sales-page uses interest dialog provider', () => {
    const src = readFileSync(join(root, 'src/marketing/sales-page.tsx'), 'utf8');
    assert.match(src, /MarketingInterestProvider/);
    assert.doesNotMatch(src, /InterestSection/);
  });

  it('sales-page wires neon sections only', () => {
    const src = readFileSync(join(root, 'src/marketing/sales-page.tsx'), 'utf8');
    assert.match(src, /NeonEventsSection/);
    assert.match(src, /NeonProductSection/);
    assert.doesNotMatch(src, /BentoSection/);
  });
});

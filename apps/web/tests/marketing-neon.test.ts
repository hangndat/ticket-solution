import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketingChrome } from '../src/marketing/chrome';
import { SalesPage } from '../src/marketing/sales-page';

describe('approved neon marketing integration', () => {
  it('renders the approved landing sections and logo in both locales', () => {
    for (const locale of ['vi', 'en'] as const) {
      const html = renderToStaticMarkup(createElement(SalesPage, { locale }));
      for (const section of ['hero', 'events', 'product', 'final-cta']) {
        assert.match(html, new RegExp(`data-testid="marketing-neon-${section}"`));
      }
      assert.match(html, /vemoki-v-mark/);
      assert.match(html, /hero-composite-v2/);
      assert.match(html, /id="interest"/);
      assert.doesNotMatch(html, /data-testid="marketing-bento"/);
    }
  });

  it('shares the approved logo while keeping journey locale routes and stage isolated', () => {
    const html = renderToStaticMarkup(MarketingChrome({
      locale: 'vi', pageKind: 'journey', children: 'Journey',
    }));
    assert.match(html, /vemoki-v-mark/);
    assert.match(html, /href="\/en\/experience"/);
    assert.match(html, /href="\/experience"/);
    assert.doesNotMatch(html, /data-testid="marketing-neon-edge-decor"/);
  });
});

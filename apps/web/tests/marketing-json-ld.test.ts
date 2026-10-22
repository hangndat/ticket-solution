import assert from 'node:assert/strict';
import { createElement } from 'react';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketingJsonLd } from '../src/marketing/seo/json-ld';

describe('MarketingJsonLd', () => {
  it('emits Organization, WebSite, SoftwareApplication without aggregateRating', () => {
    const html = renderToStaticMarkup(
      createElement(MarketingJsonLd, { locale: 'vi' }),
    );
    assert.ok(html.includes('Organization'));
    assert.ok(html.includes('WebSite'));
    assert.ok(html.includes('SoftwareApplication'));
    assert.ok(!html.includes('aggregateRating'));
    assert.ok(!html.includes('review'));
    const blocks = html.match(/application\/ld\+json/g) ?? [];
    assert.equal(blocks.length, 3);
  });
});

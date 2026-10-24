import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BENTO_CELLS } from '../src/marketing/content-config';
import { t } from '../src/marketing/copy';
import { BentoSection } from '../src/marketing/sections/bento';

function renderBentoHtml(locale: 'vi' | 'en' = 'vi') {
  return renderToStaticMarkup(
    React.createElement(BentoSection, {
      locale,
      demo: 'https://app.vemoki.com/',
      login: 'https://app.vemoki.com/auth',
    }),
  );
}

describe('marketing bento section', () => {
  it('SSR renders seven capability tiles with landmarks', () => {
    const html = renderBentoHtml('vi');
    assert.match(html, /id="features"/);
    assert.match(html, /id="bento-title"/);
    assert.equal(html.match(/data-testid="marketing-bento-item"/g)?.length, 7);
    assert.match(html, /bento-invite-title/);
    assert.doesNotMatch(html, /\.webp/);
    assert.doesNotMatch(html, /motion\/react/);
  });

  it('VI and EN bento titles differ', () => {
    assert.notEqual(t('vi', 'bento.title'), t('en', 'bento.title'));
    assert.equal(BENTO_CELLS.length, 7);
  });

  it('SSR ships static bento cards (reduced-motion-safe baseline without motion island)', () => {
    const html = renderBentoHtml('vi');
    assert.match(html, /data-testid="marketing-bento"/);
    assert.equal(html.match(/data-testid="marketing-bento-item"/g)?.length, 7);
    assert.doesNotMatch(html, /motion\/react/);
  });

  it('bento ops and admin tiles have distinct copy (no shared mockup image)', () => {
    assert.notEqual(t('vi', 'bento.admin.body'), t('vi', 'bento.ops.body'));
  });

  it('scroll reveal stays CSS-only (no client motion island in SSR)', () => {
    const html = renderBentoHtml('vi');
    assert.match(html, /data-testid="marketing-bento"/);
    assert.doesNotMatch(html, /motion\/react/);
  });
});

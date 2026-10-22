import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BENTO_CELLS } from '../src/marketing/content-config';
import { t } from '../src/marketing/copy';
import { BentoSection } from '../src/marketing/sections/bento';

describe('marketing bento section', () => {
  it('SSR renders seven capability tiles with landmarks', () => {
    const html = renderToStaticMarkup(
      React.createElement(BentoSection, {
        locale: 'vi',
        demo: 'https://app.vemoki.com/',
        login: 'https://app.vemoki.com/auth',
      }),
    );
    assert.match(html, /id="features"/);
    assert.match(html, /id="bento-title"/);
    assert.equal(html.match(/mkt-bento-item/g)?.length, 7);
    assert.match(html, /bento-invite\.webp/);
    assert.doesNotMatch(html, /motion\/react/);
  });

  it('VI and EN bento titles differ', () => {
    assert.notEqual(t('vi', 'bento.title'), t('en', 'bento.title'));
    assert.equal(BENTO_CELLS.length, 7);
  });

  it('reduced-motion: hover transition disabled in scoped CSS contract', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app/live-pulse-legacy.css'),
      'utf8',
    );
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.mkt-bento-card/);
  });
});

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function loadUi() {
  await import('../dist/index.js');
  return import('../dist/index.js');
}

describe('@ticket/ui primitives SSR', () => {
  it('renders Button with focus-safe markup', async () => {
    const { Button } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: 'primary', size: 'md' }, 'Lưu'),
    );
    assert.match(html, /<button[^>]*type="button"/);
    assert.match(html, /min-h-11/);
    assert.match(html, /hover:border-ink/);
    assert.match(html, /disabled:pointer-events-none/);
    assert.match(html, />Lưu</);
  });

  it('preserves primitive state styles when a consumer supplies legacy classes', async () => {
    const { Button, Input } = await loadUi();
    const button = renderToStaticMarkup(
      React.createElement(Button, { variant: 'primary', loading: true }, 'Gửi'),
    );
    assert.match(button, /disabled=""/);
    assert.match(button, /aria-busy="true"/);
    assert.match(button, /disabled:opacity-50/);
    assert.match(button, /aria-\[busy=true\]:cursor-wait/);
    assert.match(button, /focus-visible:ring-focus/);
    const input = renderToStaticMarkup(
      React.createElement(Input, { className: 'mkt-input', error: true, 'aria-label': 'Email' }),
    );
    assert.match(input, /aria-invalid="true"/);
    assert.match(input, /border-destructive/);
    assert.match(input, /focus-visible:ring-focus/);
  });

  it('renders Input error state with aria-invalid', async () => {
    const { Input } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(Input, { error: true, name: 'code', 'aria-label': 'Mã' }),
    );
    assert.match(html, /aria-invalid="true"/);
  });

  it('SurfaceState loading exposes aria-busy and legacy classes', async () => {
    const { SurfaceState } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(SurfaceState, {
        kind: 'loading',
        title: 'Đang tải…',
      }),
    );
    assert.match(html, /class="surface-state state-loading"/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /role="status"/);
  });

  it('renders BentoGrid without client-only APIs', async () => {
    const { BentoGrid, BentoGridItem } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(
        BentoGrid,
        null,
        React.createElement(BentoGridItem, { colSpan: 2 }, 'Invite'),
      ),
    );
    assert.match(html, /\bgrid\b/);
    assert.match(html, /md:col-span-2/);
    assert.match(html, />Invite</);
  });

  it('renders StepsTimeline without client-only APIs', async () => {
    const { StepsTimeline } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(StepsTimeline, {
        steps: [{ id: 's1', label: 'Step', visualVariant: 1 }],
      }),
    );
    assert.match(html, /lg:grid-cols-5/);
    assert.match(html, />Step</);
  });

  it('FieldError uses role alert', async () => {
    const { FieldError } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(FieldError, { id: 'code-error' }, 'Mã không hợp lệ'),
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /id="code-error"/);
  });

  it('CatalogHeroBand and DemoDataBanner render on server', async () => {
    const { CatalogHeroBand, DemoDataBanner, DemoBadge } = await loadUi();
    const hero = renderToStaticMarkup(
      React.createElement(CatalogHeroBand, {
        titleId: 'home-title',
        title: 'Hẹn bạn',
        intro: 'Intro',
      }),
    );
    assert.match(hero, /catalog-hero-band/);
    assert.match(hero, /id="home-title"/);
    const strip = renderToStaticMarkup(React.createElement(DemoDataBanner));
    assert.match(strip, /demo-data-strip/);
    assert.match(strip, /role="status"/);
    const badge = renderToStaticMarkup(React.createElement(DemoBadge));
    assert.match(badge, /demo-badge/);
  });
});

describe('@ticket/ui bundle boundary', () => {
  it('main entry does not import motion/react', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const indexSrc = fs.readFileSync(
      path.join(__dirname, '../src/index.ts'),
      'utf8',
    );
    assert.doesNotMatch(indexSrc, /motion\/react/);
    const clientSrc = fs.readFileSync(
      path.join(__dirname, '../src/client.ts'),
      'utf8',
    );
    assert.match(clientSrc, /use client/);
  });
});

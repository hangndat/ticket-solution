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
    assert.match(html, /ui:min-h-11/);
    assert.match(html, />Lưu</);
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
    assert.match(html, /ui:grid/);
    assert.match(html, /ui:md:col-span-2/);
    assert.match(html, />Invite</);
  });

  it('FieldError uses role alert', async () => {
    const { FieldError } = await loadUi();
    const html = renderToStaticMarkup(
      React.createElement(FieldError, { id: 'code-error' }, 'Mã không hợp lệ'),
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /id="code-error"/);
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

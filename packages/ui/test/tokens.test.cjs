const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const tokens = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'brand/vemoki/tokens.json'), 'utf8'),
);
const snapshot = fs.readFileSync(
  path.join(__dirname, '../src/generated/vemoki-root.snapshot.css'),
  'utf8',
);
const themeCss = fs.readFileSync(
  path.join(__dirname, '../src/generated/vemoki-theme.css'),
  'utf8',
);
const legacyCss = fs.readFileSync(
  path.join(repoRoot, 'apps/web/app/live-pulse-legacy.css'),
  'utf8',
);

function readRootVar(css, name) {
  const re = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6});`);
  const match = css.match(re);
  assert.ok(match, `missing --${name} in CSS`);
  return match[1].toUpperCase();
}

function readThemeVar(css, name) {
  const re = new RegExp(`--${name}:\\s*([^;]+);`);
  const match = css.match(re);
  assert.ok(match, `missing --${name} in theme CSS`);
  return match[1].trim();
}

describe('@ticket/ui token generator', () => {
  it('snapshot matches brand/vemoki/tokens.json colors', () => {
    for (const key of Object.keys(tokens.colors)) {
      const expected = tokens.colors[key].toUpperCase();
      assert.equal(readRootVar(snapshot, key), expected);
    }
  });

  it('legacy globals :root references generated theme colors', () => {
    const rootBlock = legacyCss.match(/:root\s*\{[^}]+\}/s);
    assert.ok(rootBlock, ':root block in live-pulse-legacy.css');
    const block = rootBlock[0];
    for (const key of ['ink', 'paper', 'signal', 'focus', 'line', 'muted']) {
      const themeKey = key === 'ink' || key === 'paper' || key === 'signal' || key === 'focus'
        ? `color-${key}`
        : `color-${key}`;
      assert.match(block, new RegExp(`--${key}:\\s*var\\(--${themeKey}\\)`));
    }
  });

  it('generated theme includes PD token groups from tokens.json', () => {
    for (const key of ['sm', 'md', 'lg', 'xl']) {
      assert.equal(readThemeVar(themeCss, `radius-${key}`), tokens.radius[key]);
    }
    for (const key of ['soft', 'frame', 'none']) {
      assert.equal(readThemeVar(themeCss, `shadow-${key}`), tokens.shadow[key]);
    }
    for (const key of Object.keys(tokens.space)) {
      const expected = `${tokens.space[key]}px`;
      assert.equal(readThemeVar(themeCss, `spacing-${key}`), expected);
    }
    for (const key of Object.keys(tokens.breakpoints)) {
      assert.equal(readThemeVar(themeCss, `breakpoint-${key}`), `${tokens.breakpoints[key]}px`);
    }
    for (const key of ['line', 'muted', 'destructive', 'admit', 'unknown']) {
      assert.equal(
        readThemeVar(themeCss, `color-${key}`).toUpperCase(),
        tokens.colors[key].toUpperCase(),
      );
    }
  });

  it('generated theme file is committed (no drift)', () => {
    const themePath = path.join(__dirname, '../src/generated/vemoki-theme.css');
    assert.ok(fs.existsSync(themePath), 'vemoki-theme.css must exist after build');
    assert.match(
      fs.readFileSync(themePath, 'utf8'),
      /@theme\s*\{[\s\S]*--color-ink:\s*#0B1220/,
    );
  });

  it('legacy contract :root exposes unprefixed theme vars for prefix(ui)', () => {
    const rootBlocks = [...themeCss.matchAll(/:root\s*\{([^}]+)\}/g)];
    assert.ok(rootBlocks.length >= 1, ':root legacy contract block in vemoki-theme.css');
    const contract = rootBlocks[rootBlocks.length - 1][1];
    assert.match(contract, /--color-line:\s*#D7DFE9/);
    assert.match(contract, /--spacing-lg:\s*16px/);
  });
});

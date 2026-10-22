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

describe('@ticket/ui token generator', () => {
  it('snapshot matches brand/vemoki/tokens.json', () => {
    for (const key of ['ink', 'paper', 'signal', 'focus']) {
      const expected = tokens.colors[key].toUpperCase();
      assert.equal(readRootVar(snapshot, key), expected);
    }
  });

  it('legacy globals :root matches tokens.json', () => {
    const rootBlock = legacyCss.match(/:root\s*\{[^}]+\}/s);
    assert.ok(rootBlock, ':root block in live-pulse-legacy.css');
    for (const key of ['ink', 'paper', 'signal', 'focus']) {
      const expected = tokens.colors[key].toUpperCase();
      assert.equal(readRootVar(rootBlock[0], key), expected);
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
});
